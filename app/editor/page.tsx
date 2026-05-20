"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const Editor = dynamic(
  () => import("@/components/Editor").then((module) => module.Editor),
  {
    ssr: false
  }
);

function EditorWithQueryProject() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("id") ?? searchParams.get("projectId");

  return <Editor initialProjectId={projectId} />;
}

export default function EditorPage() {
  return (
    <Suspense fallback={null}>
      <EditorWithQueryProject />
    </Suspense>
  );
}
