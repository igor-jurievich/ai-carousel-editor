export type TextRole = "title" | "body" | "caption";
export type CarouselTemplateId = "dark" | "light" | "color";
export type SlideFormat = "1:1" | "4:5" | "9:16";
export type ElementMetaKey = string;
export type ImageFitMode = "cover" | "contain" | "original";

export type CarouselSlideRole =
  | "hook"
  | "problem"
  | "amplify"
  | "mistake"
  | "consequence"
  | "shift"
  | "solution"
  | "example"
  | "cta";

export type CanvasSlideType = "text" | "list" | "big_text" | "image_text" | "cta";

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
  profileHandle?: string;
  profileSubtitle?: string;
  backgroundImage?: string | null;
  photoSlotEnabled?: boolean;
  generationRole?: CarouselSlideRole;
  slideType?: CanvasSlideType;
  generationCoreIdea?: string;
};

export type HookOutlineSlide = {
  type: "hook";
  title: string;
  subtitle: string;
};

export type ProblemOutlineSlide = {
  type: "problem";
  title: string;
  bullets: string[];
};

export type AmplifyOutlineSlide = {
  type: "amplify";
  title: string;
  bullets: string[];
};

export type MistakeOutlineSlide = {
  type: "mistake";
  title: string;
};

export type ConsequenceOutlineSlide = {
  type: "consequence";
  bullets: string[];
};

export type ShiftOutlineSlide = {
  type: "shift";
  title: string;
};

export type SolutionOutlineSlide = {
  type: "solution";
  bullets: string[];
};

export type ExampleOutlineSlide = {
  type: "example";
  before: string;
  after: string;
};

export type CtaOutlineSlide = {
  type: "cta";
  title: string;
  subtitle: string;
};

export type CarouselOutlineSlide =
  | HookOutlineSlide
  | ProblemOutlineSlide
  | AmplifyOutlineSlide
  | MistakeOutlineSlide
  | ConsequenceOutlineSlide
  | ShiftOutlineSlide
  | SolutionOutlineSlide
  | ExampleOutlineSlide
  | CtaOutlineSlide;

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
  format?: SlideFormat;
  theme?: CarouselTemplateId;
  niche?: string;
  audience?: string;
  tone?: string;
  goal?: string;
  language?: "ru";
  schemaVersion?: number;
  caption?: CarouselPostCaption | null;
  createdAt?: string;
  updatedAt?: string;
  slides: Slide[];
};

export type CarouselPostCaption = {
  text: string;
  cta: string;
  hashtags: string[];
};

export type CarouselTemplate = {
  id: CarouselTemplateId;
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
  titleOffsetY?: number;
  bodyOffsetY?: number;
  titleWidth?: number;
  bodyWidth?: number;
  bodyHeight?: number;
  chipStyle?: "solid" | "outline";
  decoration?: "grid" | "none";
  accentMode?: "none" | "text" | "chip";
  gridMode?: "full" | "vertical";
  gridStep?: number;
  gridOpacity?: number;
  preview?: string;
};
