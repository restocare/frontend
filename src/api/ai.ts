/**
 * AI features: PDF assistant and AI tutor.
 *
 * Split out of the former single api.ts; import from "@/src/api/api" as before.
 */

import { apiClient } from "./apiClient";

// Gemini-vision analysis for the PDF editor tool: OCR + typography of a
// cropped page region, so edits can match font, color, slant and aging.

export interface PdfRegionAnalysis {
  text: string;
  fontCategory: "sans" | "serif" | "mono";
  fontName: string;
  bold: boolean;
  italic: boolean;
  slantDegrees: number;
  colorHex: string;
  backgroundHex: string;
  aged: boolean;
  blur: "none" | "slight" | "strong";
}

export const pdfAiApi = {
  /** POST /v1/pdf-ai/analyze — image is a PNG/JPEG data URL of the cropped region. */
  analyze: (image: string) =>
    apiClient.post<PdfRegionAnalysis>("/v1/pdf-ai/analyze", { image }),
};

// The animated speaking teacher behind the admin panel's AI Tutor tab.
// `ask` returns a spoken-style plain-text answer; `speak` returns Gemini TTS
// audio as base64 PCM (mimeType carries the sample rate, e.g. rate=24000).

export interface TutorTurn {
  role: "user" | "tutor";
  text: string;
}

export type TutorSpeechLang = "hi-IN" | "en-IN";

// Whiteboard scene primitives — mirrors the backend sanitizer's whitelist.
// Coordinates: x 0-100 (left→right), y 0-75 (top→bottom); drawing is
// cumulative across steps.
export type TutorVisualColor = "ink" | "gold" | "sky" | "rose" | "mint";

export type TutorVisualItem =
  | {
      type: "text";
      x: number;
      y: number;
      text: string;
      size: number;
      color: TutorVisualColor;
    }
  | {
      type: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: TutorVisualColor;
      dashed: boolean;
    }
  | {
      type: "arrow";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: TutorVisualColor;
    }
  | {
      type: "circle";
      x: number;
      y: number;
      r: number;
      color: TutorVisualColor;
      fill: boolean;
    }
  | {
      type: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      color: TutorVisualColor;
      fill: boolean;
    }
  | {
      type: "polygon";
      points: [number, number][];
      color: TutorVisualColor;
      fill: boolean;
    }
  | { type: "polyline"; points: [number, number][]; color: TutorVisualColor }
  | { type: "point"; x: number; y: number; label: string }
  | {
      type: "number-line";
      y: number;
      from: number;
      to: number;
      highlights: number[];
    }
  | {
      type: "fraction-circle";
      x: number;
      y: number;
      r: number;
      num: number;
      den: number;
    }
  | {
      type: "angle";
      x: number;
      y: number;
      start: number;
      end: number;
      r: number;
      label: string;
    };

export interface TutorVisualStep {
  caption: string;
  items: TutorVisualItem[];
}

export type TutorVisual =
  | { applicable: false }
  | { applicable: true; title: string; steps: TutorVisualStep[] };

/** Expert badge keys — must mirror the backend's TUTOR_PERSONAS whitelist. */
export type TutorPersona =
  | "doctor"
  | "electrician"
  | "technician"
  | "developer"
  | "scientist"
  | "astrologer"
  | "student"
  | "chef"
  | "lawyer"
  | "fitness";

/** One live tutor turn: answer text + natively spoken base64 PCM audio. */
export interface TutorConverseResult {
  answer: string;
  audio: string;
  mimeType: string;
  languageCode: string;
}

export const aiTutorApi = {
  /** POST /v1/ai-tutor/converse — one Gemini Live turn (text + voice together). */
  converse: (body: {
    question: string;
    history?: TutorTurn[];
    persona?: TutorPersona;
    languageCode?: TutorSpeechLang;
  }) => apiClient.post<TutorConverseResult>("/v1/ai-tutor/converse", body),
  /** Step-by-step whiteboard scene for the question, or applicable:false. */
  visualize: (body: { question: string; answer?: string }) =>
    apiClient.post<TutorVisual>("/v1/ai-tutor/visualize", body),
};
