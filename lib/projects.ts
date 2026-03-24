import type { CarouselProject, CarouselProjectSummary, Slide } from "@/types/editor";

const STORAGE_KEY = "ai-carousel.projects.v1";

type StoredProject = CarouselProject & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function cloneSlides(slides: Slide[]) {
  return slides.map((slide) => ({
    ...slide,
    elements: slide.elements.map((element) => ({ ...element }))
  }));
}

function normalizeStoredProject(project: StoredProject): StoredProject {
  return {
    ...project,
    language: "ru",
    schemaVersion: Math.max(1, Number(project.schemaVersion ?? 1)),
    format: project.format ?? "1:1",
    theme: project.theme ?? "light",
    caption: project.caption ?? null,
    slides: cloneSlides(project.slides ?? [])
  };
}

function readAllProjects() {
  if (!canUseStorage()) {
    return [] as StoredProject[];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [] as StoredProject[];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [] as StoredProject[];
    }

    return parsed
      .filter((item): item is StoredProject => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      .filter((item) => typeof item.id === "string" && item.id.trim().length > 0)
      .map((item) => normalizeStoredProject(item))
      .sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1));
  } catch {
    return [] as StoredProject[];
  }
}

function writeAllProjects(projects: StoredProject[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function listLocalProjects() {
  return readAllProjects().map((project) => ({
    id: project.id,
    title: project.title,
    topic: project.topic,
    updatedAt: project.updatedAt
  })) satisfies CarouselProjectSummary[];
}

export function getLocalProject(projectId: string) {
  if (!projectId.trim()) {
    return null;
  }

  const found = readAllProjects().find((project) => project.id === projectId);
  if (!found) {
    return null;
  }

  return {
    ...found,
    slides: cloneSlides(found.slides)
  } satisfies CarouselProject;
}

export function saveLocalProject(project: CarouselProject) {
  const now = new Date().toISOString();
  const current = readAllProjects();
  const projectId = (project.id && project.id.trim()) || crypto.randomUUID();
  const existing = current.find((item) => item.id === projectId);

  const nextProject = normalizeStoredProject({
    ...project,
    id: projectId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  });

  const next = [nextProject, ...current.filter((item) => item.id !== projectId)];
  writeAllProjects(next);

  return {
    ...nextProject,
    slides: cloneSlides(nextProject.slides)
  } satisfies CarouselProject;
}

export function deleteLocalProject(projectId: string) {
  const current = readAllProjects();
  const next = current.filter((project) => project.id !== projectId);
  writeAllProjects(next);
}
