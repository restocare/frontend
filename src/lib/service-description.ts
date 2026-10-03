/**
 * Service descriptions come from the admin panel in mixed shapes: some start
 * with a heading glued on without punctuation ("Fan Repair by Resto Care
 * Restore your fan's…"), some are only the service name, and the API cuts
 * them at 400 characters, often mid-word ("…Why Choose Inverte"). These
 * helpers turn that into whole sentences, so cards never end mid-sentence.
 * Pure: no DOM, no API.
 */

/** Longest card summary before we stop adding sentences. */
const SUMMARY_MAX = 160;

/** The API truncates descriptions at this length. */
const API_CUT = 390;

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const isComplete = (s: string) => /[.!?]["'”’)]?$/.test(s);

/**
 * The description as whole sentences: no glued-on heading, no cut-off tail.
 * Empty when nothing useful is left (e.g. it only repeated the service name).
 */
export function cleanDescription(raw: string | null | undefined, serviceName = ""): string {
  let text = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";

  // "<Heading> by Resto Care <Sentence…>" → "<Sentence…>"
  text = text.replace(/^.{0,140}?\bby Resto ?Care\s+(?=[A-Z])/, "");

  const parts = sentences(text);
  while (parts.length && !isComplete(parts[parts.length - 1])) parts.pop();

  // No full sentence at all: keep short unpunctuated copy, drop a cut-off one.
  let out = parts.length ? parts.join(" ") : text.length < API_CUT ? text : "";
  if (out.toLowerCase() === serviceName.trim().toLowerCase()) out = "";
  return out;
}

/** First sentence, plus following ones while they fit in a card. */
export function summarizeDescription(clean: string): string {
  const parts = sentences(clean);
  let out = parts[0] ?? "";
  for (const s of parts.slice(1)) {
    if (out.length + 1 + s.length > SUMMARY_MAX) break;
    out += ` ${s}`;
  }
  return out;
}
