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
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function SlideImageNode({
  element,
  interactive = false,
  selected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  nodeRef
}: {
  element: ImageElement;
  interactive?: boolean;
  selected: boolean;
  onSelect?: () => void;
  onDragEnd?: (x: number, y: number) => void;
  onTransformEnd?: (node: Konva.Image) => void;
  nodeRef: (node: Konva.Image | null) => void;
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
      draggable={interactive && !isBackground}
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
  nodeRef
}: {
  element: ShapeElement;
  interactive?: boolean;
  selected: boolean;
  onSelect?: () => void;
  onDragEnd?: (x: number, y: number) => void;
  onTransformEnd?: (node: Konva.Rect) => void;
  nodeRef: (node: Konva.Rect | null) => void;
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
      draggable={interactive}
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
  nodeRef
}: {
  element: TextElement;
  interactive?: boolean;
  selected: boolean;
  onSelect?: () => void;
  onDoubleClick?: () => void;
  onDragEnd?: (x: number, y: number) => void;
  onTransformEnd?: (node: Konva.Text) => void;
  nodeRef: (node: Konva.Text | null) => void;
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
      draggable={interactive}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onDoubleClick}
      onDblTap={onDoubleClick}
      onDragEnd={(event) => onDragEnd?.(event.target.x(), event.target.y())}
      onTransformEnd={(event) => onTransformEnd?.(event.target as Konva.Text)}
      stroke={selected ? "#72d6cb" : undefined}
      strokeWidth={selected ? 2.2 : 0}
      shadowColor={selected ? "rgba(114, 214, 203, 0.35)" : undefined}
      shadowBlur={selected ? 12 : 0}
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
  stageRef
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

  const handleTransformEnd = (element: CanvasElement, node: Konva.Node) => {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const nextWidth = clamp(element.width * scaleX, 30, canvasWidth);
    const nextHeight = clamp(element.height * scaleY, 24, canvasHeight);
    const nextX = clamp(node.x(), 0, canvasWidth - nextWidth);
    const nextY = clamp(node.y(), 0, canvasHeight - nextHeight);
    const updates: Record<string, number> = {
      x: nextX,
      y: nextY,
      width: nextWidth,
      height: nextHeight,
      rotation: node.rotation()
    };

    if (element.type === "text") {
      updates.fontSize = clamp(element.fontSize * scaleY, 14, 220);
    }

    node.scaleX(1);
    node.scaleY(1);
    onTransformElement?.(element.id, updates);
  };

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
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

        {slide.elements.map((element) => {
          const selected = selectedElementId === element.id;

          const handleDragEnd = (x: number, y: number) => {
            const safeX = clamp(x, 0, canvasWidth - element.width);
            const safeY = clamp(y, 0, canvasHeight - element.height);
            onUpdateElementPosition?.(element.id, safeX, safeY);
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
