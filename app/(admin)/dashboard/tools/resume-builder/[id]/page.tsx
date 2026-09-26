"use client";

import { useParams } from "next/navigation";
import { ResumeEditor } from "@/src/components/resume-builder/resume-editor";

export default function ResumeEditorPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  if (!Number.isFinite(id)) {
    return <p className="text-sm text-danger">Invalid resume id.</p>;
  }
  return <ResumeEditor resumeId={id} />;
}
