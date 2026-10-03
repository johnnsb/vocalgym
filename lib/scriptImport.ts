// Pull plain text out of an uploaded script file, client-side. .txt / .md are
// read directly; .pdf is parsed with pdf.js, lazy-loaded only when needed.

export const ACCEPTED_UPLOAD =
  ".txt,.text,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_SCRIPT_CHARS = 8000;

// non-breaking / thin / other unicode spaces -> plain space
const ODD_SPACES = /[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g;

function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(ODD_SPACES, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  try {
    const doc = await task.promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let line = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        line += item.str;
        line += item.hasEOL ? "\n" : " ";
      }
      pages.push(line);
    }
    return pages.join("\n\n");
  } finally {
    await task.destroy();
  }
}

export interface ImportedScript {
  text: string;
  truncated: boolean;
}

/** Throws an Error with a user-facing message on anything unreadable. */
/** `maxChars` defaults to MAX_SCRIPT_CHARS (8,000) — existing callers are
 *  unchanged; presentation notes pass their own 12,000 limit. */
export async function extractScriptText(
  file: File,
  opts: { maxChars?: number } = {},
): Promise<ImportedScript> {
  const maxChars = opts.maxChars ?? MAX_SCRIPT_CHARS;
  if (file.size === 0) throw new Error("That file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("That file is over the 5 MB limit.");
  }

  const name = file.name.toLowerCase();
  const type = file.type;
  const isPdf = type === "application/pdf" || name.endsWith(".pdf");
  const isText =
    type.startsWith("text/") || /\.(txt|text|md|markdown)$/.test(name);

  if (!isPdf && !isText) {
    throw new Error("Unsupported file — upload a .txt, .md, or .pdf.");
  }

  let raw: string;
  try {
    raw = isPdf ? await extractPdf(file) : await file.text();
  } catch {
    throw new Error(
      isPdf
        ? "Couldn't read that PDF. If it's a scan, paste the text in instead."
        : "Couldn't read that file.",
    );
  }

  const text = tidy(raw);
  if (!text) {
    throw new Error(
      isPdf
        ? "No selectable text in that PDF (it may be a scanned image)."
        : "That file had no readable text.",
    );
  }

  return text.length > maxChars
    ? { text: text.slice(0, maxChars), truncated: true }
    : { text, truncated: false };
}
