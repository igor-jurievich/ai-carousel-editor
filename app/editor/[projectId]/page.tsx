"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const Editor = dynamic(
  () => import("@/components/Editor").then((module) => module.Editor),
  {
    ssr: false
  }
);

export default function EditorProjectPage() {
  const params = useParams<{ projectId: string | string[] }>();
  const projectId = Array.isArray(params?.projectId) ? params.projectId[0] : params?.projectId;

  return <Editor initialProjectId={projectId ?? null} />;
}
