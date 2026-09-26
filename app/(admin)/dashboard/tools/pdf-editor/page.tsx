import type { Metadata } from "next";
import { PdfEditor } from "@/src/components/pdf-editor/pdf-editor";

export const metadata: Metadata = {
  title: "PDF Editor",
  description: "Upload a PDF and edit its text in place with matched fonts.",
};

export default function PdfEditorPage() {
  return <PdfEditor />;
}
