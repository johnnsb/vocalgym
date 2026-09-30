import { strFromU8, unzipSync } from "fflate";
import { capSlides } from "./presentationPrep";
import type { PresentationSlide } from "./types";

// .pptx → slides (title + speaker notes), entirely in the browser. A .pptx is
// a zip of XML parts; slide order comes from ppt/presentation.xml's sldIdLst
// (NOT file names — slide10.xml can come before slide2.xml). The XML helpers
// are plain string functions so they're unit-testable in Node without a DOM.
// Dynamically imported by SlideListEditor only when a .pptx is picked.

const MAX_PPTX_BYTES = 50 * 1024 * 1024;

export function decodeXmlEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    const k = e.toLowerCase();
    if (k === "amp") return "&";
    if (k === "lt") return "<";
    if (k === "gt") return ">";
    if (k === "quot") return '"';
    if (k === "apos") return "'";
    const code = k.startsWith("#x") ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : "";
  });
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? m[1] : null;
}

function relationships(relsXml: string): { id: string; type: string; target: string }[] {
  return Array.from(relsXml.matchAll(/<Relationship\b[^>]*>/g)).map((m) => ({
    id: attr(m[0], "Id") ?? "",
    type: attr(m[0], "Type") ?? "",
    target: attr(m[0], "Target") ?? "",
  }));
}

/** Resolve a relationship target relative to the folder of `fromPath`. */
export function resolveTarget(fromPath: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = fromPath.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg && seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

export function slideOrder(presentationXml: string, relsXml: string): string[] {
  const byId = new Map(relationships(relsXml).map((r) => [r.id, r.target]));
  return Array.from(presentationXml.matchAll(/<p:sldId\b[^>]*>/g))
    .map((m) => attr(m[0], "r:id"))
    .map((rid) => (rid ? byId.get(rid) : undefined))
    .filter((t): t is string => Boolean(t))
    .map((t) => resolveTarget("ppt/presentation.xml", t));
}

export function notesPathFor(slideRelsXml: string, slidePath: string): string | null {
  const rel = relationships(slideRelsXml).find((r) => /\/notesSlide$/.test(r.type));
  return rel ? resolveTarget(slidePath, rel.target) : null;
}

function shapes(xml: string): string[] {
  return Array.from(xml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/g)).map((m) => m[0]);
}

function placeholderType(shape: string): string | null {
  const ph = shape.match(/<p:ph\b[^>]*>/);
  if (!ph) return null;
  return attr(ph[0], "type") ?? "body";
}

// A line break inside a paragraph (Shift+Enter) is <a:br/> or <a:br>…</a:br>;
// turn it into a newline run so words on either side don't run together.
const LINE_BREAK = /<a:br\b[^>]*\/>|<a:br\b[^>]*>[\s\S]*?<\/a:br>/g;

function paragraphs(shape: string): string[] {
  return Array.from(
    shape
      .replace(/<a:p\b[^>]*\/>/g, "")
      .replace(LINE_BREAK, "<a:t>\n</a:t>")
      .matchAll(/<a:p\b[\s\S]*?<\/a:p>/g),
  )
    .map((p) =>
      decodeXmlEntities(Array.from(p[0].matchAll(/<a:t>([^<]*)<\/a:t>/g)).map((t) => t[1]).join("")).trim(),
    )
    .filter(Boolean);
}

export function slideTitle(slideXml: string): string {
  const title = shapes(slideXml).find((s) => /^(title|ctrTitle)$/.test(placeholderType(s) ?? ""));
  return title ? paragraphs(title).join(" ").replace(/\s*\n\s*/g, " ") : "";
}

const NON_NOTE_PLACEHOLDERS = new Set(["sldNum", "sldImg", "hdr", "ftr", "dt"]);

export function notesText(notesXml: string): string {
  return shapes(notesXml)
    .filter((s) => !NON_NOTE_PLACEHOLDERS.has(placeholderType(s) ?? ""))
    .flatMap(paragraphs)
    .join("\n");
}

function newSlideId(i: number): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `slide-${i + 1}-${rand}`;
}

export function slidesFromZip(files: Record<string, Uint8Array>): {
  slides: PresentationSlide[];
  truncated: boolean;
  hadNotes: boolean;
} {
  const read = (p: string) => (files[p] ? strFromU8(files[p]) : null);
  const pres = read("ppt/presentation.xml");
  const presRels = read("ppt/_rels/presentation.xml.rels");
  if (!pres || !presRels) throw new Error("Couldn't read that PowerPoint file.");

  const paths = slideOrder(pres, presRels);
  if (!paths.length) throw new Error("That deck has no slides.");

  const slides = paths.map((path, i) => {
    const xml = read(path) ?? "";
    const relsPath = path.replace(/([^/]+)$/, "_rels/$1.rels");
    const rels = read(relsPath);
    const notesPath = rels ? notesPathFor(rels, path) : null;
    const notesXml = notesPath ? read(notesPath) : null;
    return { id: newSlideId(i), title: slideTitle(xml), notes: notesXml ? notesText(notesXml) : "" };
  });

  const hadNotes = slides.some((s) => s.notes.trim());
  const capped = capSlides(
    slides.map((s) => ({ ...s, title: s.title.slice(0, 200), notes: s.notes.slice(0, 2000) })),
  );
  const perSlideCut = slides.some((s) => s.title.length > 200 || s.notes.length > 2000);
  return { slides: capped.slides, truncated: capped.truncated || perSlideCut, hadNotes };
}

/** Throws Error with a user-facing message on anything unreadable. */
export async function extractSlides(file: File): Promise<{
  slides: PresentationSlide[];
  truncated: boolean;
  hadNotes: boolean;
}> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".ppt")) throw new Error("Save it as .pptx and try again.");
  if (file.size > MAX_PPTX_BYTES) throw new Error("That file is over the 50 MB limit.");
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      // Only the XML parts we need — skips media, which can be huge.
      filter: (f) => f.name.startsWith("ppt/") && f.name.endsWith(".xml") || f.name.endsWith(".rels"),
    });
  } catch {
    throw new Error("Couldn't read that PowerPoint file.");
  }
  return slidesFromZip(files);
}
