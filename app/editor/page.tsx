"use client";

import dynamic from "next/dynamic";

const Editor = dynamic(
  () => import("@/components/Editor").then((module) => module.Editor),
  {
    ssr: false
  }
);

export default function EditorPage() {
  return <Editor />;
}
