"use client";

import { useEffect, useMemo, useRef } from "react";
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

const TEXT_SAFE_AREA = {
  insetX: 56,
  insetTop: 84,
  insetBottom: 96
};

type DragBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

function resolveDragBounds(
  element: CanvasElement,
  canvasWidth: number,
  canvasHeight: number,
  width = element.width,
  height = element.height
): DragBounds {
  if (element.type !== "text") {
    return {
      minX: 0,
      maxX: Math.max(0, canvasWidth - width),
      minY: 0,
      maxY: Math.max(0, canvasHeight - height)
    };
  }

  const maxTextWidth = Math.max(60, canvasWidth - TEXT_SAFE_AREA.insetX * 2);
  const maxTextHeight = Math.max(
    28,
    canvasHeight - TEXT_SAFE_AREA.insetTop - TEXT_SAFE_AREA.insetBottom
  );
  const safeWidth = Math.min(width, maxTextWidth);
  const safeHeight = Math.min(height, maxTextHeight);

  return {
    minX: TEXT_SAFE_AREA.insetX,
    maxX: Math.max(TEXT_SAFE_AREA.insetX, canvasWidth - TEXT_SAFE_AREA.insetX - safeWidth),
    minY: TEXT_SAFE_AREA.insetTop,
    maxY: Math.max(
      TEXT_SAFE_AREA.insetTop,
      canvasHeight - TEXT_SAFE_AREA.insetBottom - safeHeight
    )
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

  return (
    <KonvaImage
      ref={nodeRef}
      image={image}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      opacity={element.opacity}
      rotation={element.rotation}
      cornerRadius={element.cornerRadius}
      listening={!isBackground}
      draggable={interactive && selected && !isBackground}
      dragDistance={10}
      dragBoundFunc={isBackground ? undefined : dragBoundFunc}
      onClick={isBackground ? undefined : onSelect}
      onTap={isBackground ? undefined : onSelect}
      onDragEnd={
        isBackground ? undefined : (event) => onDragEnd?.(event.target.x(), event.target.y())
      }
      onTransformEnd={isBackground ? undefined : (event) => onTransformEnd?.(event.target as Konva.Image)}
      stroke={selected ? "#72d6cb" : undefined}
      strokeWidth={selected ? 4 : 0}
      shadowBlur={selected ? 18 : 0}
      shadowColor={selected ? "rgba(114, 214, 203, 0.35)" : undefined}
    />
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
      height={element.height}
      fontSize={element.fontSize}
      fontFamily={element.fontFamily}
      fontStyle={element.fontStyle}
      fill={element.fill}
      align={element.align}
      lineHeight={element.lineHeight ?? 1.1}
      opacity={element.opacity}
      rotation={element.rotation}
      letterSpacing={element.letterSpacing}
      textDecoration={element.textDecoration}
      draggable={interactive && selected}
      dragDistance={10}
      dragBoundFunc={dragBoundFunc}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onDoubleClick}
      onDblTap={onDoubleClick}
      onDragEnd={(event) => onDragEnd?.(event.target.x(), event.target.y())}
      onTransformEnd={(event) => onTransformEnd?.(event.target as Konva.Text)}
      strokeEnabled={false}
      shadowEnabled={false}
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
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});

  useEffect(() => {
    if (!interactive || !transformerRef.current) {
      return;
    }

    const selectedNode = selectedElementId ? nodeRefs.current[selectedElementId] : null;

    transformerRef.current.nodes(selectedNode ? [selectedNode] : []);
    transformerRef.current.getLayer()?.batchDraw();
  }, [interactive, selectedElementId, slide.elements]);

  const selectedElement = selectedElementId
    ? slide.elements.find((element) => element.id === selectedElementId) ?? null
    : null;

  const handleTransformEnd = (element: CanvasElement, node: Konva.Node) => {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const maxWidth =
      element.type === "text"
        ? Math.max(120, canvasWidth - TEXT_SAFE_AREA.insetX * 2)
        : canvasWidth;
    const maxHeight =
      element.type === "text"
        ? Math.max(42, canvasHeight - TEXT_SAFE_AREA.insetTop - TEXT_SAFE_AREA.insetBottom)
        : canvasHeight;
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

    if (element.type === "image") {
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
      nextHeight = clamp(estimateTextHeight(element, nextWidth), 42, maxHeight);
    }

    const bounds = resolveDragBounds(element, canvasWidth, canvasHeight, nextWidth, nextHeight);
    const clampedPosition = clampPosition({ x: node.x(), y: node.y() }, bounds);
    const updates: Record<string, number> = {
      x: clampedPosition.x,
      y: clampedPosition.y,
      width: nextWidth,
      height: nextHeight,
      rotation: node.rotation()
    };

    node.scaleX(1);
    node.scaleY(1);
    onTransformElement?.(element.id, updates);
  };

  return (
    <Stage
      ref={stageRef}
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
          onSelectElement?.(null);
        }
      }}
      onTouchStart={(event) => {
        if (event.target === event.target.getStage()) {
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

        {slide.elements
          .filter((element) => {
            if (showSlideBadge) {
              return true;
            }
            return element.metaKey !== "slide-chip" && element.metaKey !== "slide-chip-text";
          })
          .map((element) => {
          const selected = selectedElementId === element.id;
          const dragBounds = resolveDragBounds(element, canvasWidth, canvasHeight);

          const handleDragEnd = (x: number, y: number) => {
            const nextPosition = clampPosition({ x, y }, dragBounds);
            const safeX = nextPosition.x;
            const safeY = nextPosition.y;
            onUpdateElementPosition?.(element.id, safeX, safeY);
          };

          const dragBoundFunc = (position: { x: number; y: number }) =>
            clampPosition(position, dragBounds);

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
            keepRatio={selectedElement?.type === "image"}
            enabledAnchors={
              selectedElement?.type === "text"
                ? ["middle-left", "middle-right"]
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
