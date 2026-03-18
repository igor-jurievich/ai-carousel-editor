export type TextRole = "title" | "body" | "caption";
export type CarouselTemplateId = string;
export type SlideFormat = "1:1" | "4:5" | "9:16";
export type FooterVariantId = "v1" | "v2" | "v3" | "v4";
export type TemplateCategoryId = "dark" | "light" | "color";
export type ElementMetaKey = string;
export type ImageFitMode = "cover" | "contain" | "original";
export type CarouselSlideRole =
  | "cover"
  | "problem"
  | "myth"
  | "mistake"
  | "tip"
  | "steps"
  | "checklist"
  | "case"
  | "comparison"
  | "summary"
  | "cta";
export type CarouselLayoutType =
  | "hero"
  | "statement"
  | "list"
  | "split"
  | "card"
  | "dark-slide"
  | "cover-hero"
  | "title-body"
  | "bullets"
  | "steps"
  | "checklist"
  | "case-split"
  | "comparison"
  | "summary"
  | "cta"
  | "image-top";
export type CarouselImageIntent =
  | "none"
  | "subject-photo"
  | "people-photo"
  | "object-photo"
  | "conceptual-photo";

export type TextElement = {
  id: string;
  type: "text";
  role: TextRole;
  metaKey?: ElementMetaKey;
  wasAutoTruncated?: boolean;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  fontStyle?: string;
  fill: string;
  align: "left" | "center" | "right";
  lineHeight?: number;
  rotation: number;
  opacity: number;
  letterSpacing?: number;
  textDecoration?: string;
};

export type ShapeElement = {
  id: string;
  type: "shape";
  metaKey?: ElementMetaKey;
  shape: "rect" | "circle";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  opacity: number;
  rotation: number;
  cornerRadius: number;
  stroke?: string;
  strokeWidth?: number;
};

export type ImageElement = {
  id: string;
  type: "image";
  metaKey?: ElementMetaKey;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  rotation: number;
  cornerRadius: number;
  fitMode?: ImageFitMode;
  zoom?: number;
  offsetX?: number;
  offsetY?: number;
  naturalWidth?: number;
  naturalHeight?: number;
  darken?: number;
  stroke?: string;
  strokeWidth?: number;
};

export type CanvasElement = TextElement | ShapeElement | ImageElement;

export type Slide = {
  id: string;
  name: string;
  background: string;
  elements: CanvasElement[];
  templateId?: CarouselTemplateId;
  footerVariant?: FooterVariantId;
  profileHandle?: string;
  profileSubtitle?: string;
  backgroundImage?: string | null;
  imageLayoutMode?: "background" | "top" | "bottom";
  backgroundImageFitMode?: ImageFitMode;
  backgroundImageZoom?: number;
  backgroundImageOffsetX?: number;
  backgroundImageOffsetY?: number;
  backgroundImageDarken?: number;
  frameColor?: string;
  generationRole?: CarouselSlideRole;
  generationCoreIdea?: string;
  layoutType?: CarouselLayoutType;
  imageIntent?: CarouselImageIntent;
  imageQueryDraft?: string;
};

export type CarouselOutlineSlide = {
  title: string;
  text: string;
  role?: CarouselSlideRole;
  coreIdea?: string;
  layoutType?: CarouselLayoutType;
  imageIntent?: CarouselImageIntent;
  imageQueryDraft?: string;
  templateId?: CarouselTemplateId;
};

export type CarouselProjectSummary = {
  id: string;
  title: string;
  topic: string;
  updatedAt: string;
};

export type CarouselProject = {
  id?: string;
  title: string;
  topic: string;
  slides: Slide[];
};

export type CarouselTemplate = {
  id: CarouselTemplateId;
  category: TemplateCategoryId;
  name: string;
  description: string;
  accent: string;
  accentAlt?: string;
  background: string;
  surface: string;
  titleColor: string;
  bodyColor: string;
  titleFont: string;
  bodyFont: string;
  titleOffsetY: number;
  bodyOffsetY: number;
  titleWidth?: number;
  bodyWidth?: number;
  bodyHeight?: number;
  chipStyle: "solid" | "outline";
  decoration: "band" | "grid" | "glow" | "paper" | "dots" | "lines" | "bolts" | "none";
  preview?: string;
};
