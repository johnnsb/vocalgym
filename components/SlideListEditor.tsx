"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { reportClientError } from "@/lib/clientErrors";
import { newId } from "@/lib/practiceStore";
import { PRESENTATION_LIMITS } from "@/lib/presentationPrep";
import type { PresentationSlide } from "@/lib/types";
import { Button, Callout, Card, IconButton, Input, Textarea } from "@/components/ui";

// Slides-mode editor: import a .pptx (parsed in the browser — lib/pptxImport
// is dynamically imported so fflate stays out of the main bundle) or add
// slides by hand; every row's title + notes stay editable. Re-importing over
// existing slides asks inline first (no browser dialogs).

interface Props {
  slides: PresentationSlide[];
  onChange: (slides: PresentationSlide[]) => void;
}

export default function SlideListEditor({ slides, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  function pick() {
    if (slides.length && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    setConfirmReplace(false);
    fileRef.current?.click();
  }

  async function handle(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { extractSlides } = await import("@/lib/pptxImport");
      const r = await extractSlides(file);
      onChange(r.slides);
      const parts = [`Imported ${r.slides.length} slide${r.slides.length === 1 ? "" : "s"} from “${file.name}”.`];
      if (r.truncated) parts.push("Trimmed to 40 slides / 20,000 characters of notes.");
      if (!r.hadNotes) parts.push("No speaker notes found — add talking points per slide.");
      setNotice(parts.join(" "));
    } catch (err) {
      reportClientError(err, { area: "presentation:pptx-import" });
      setError(err instanceof Error ? err.message : "Couldn't read that PowerPoint file.");
    } finally {
      setBusy(false);
    }
  }

  const update = (id: string, patch: Partial<PresentationSlide>) =>
    onChange(slides.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" icon="upload" onClick={pick} disabled={busy}>
          {busy ? "Reading…" : slides.length ? "Re-import .pptx" : "Import .pptx"}
        </Button>
        <input ref={fileRef} type="file" accept=".pptx,.ppt" onChange={handle} className="hidden" />
        <span className="text-caption text-text-muted">
          Reads slide titles + speaker notes in your browser — the file isn&apos;t uploaded.
        </span>
      </div>

      {confirmReplace && (
        <Callout tone="caution">
          <div className="flex flex-wrap items-center gap-3">
            <span>Replace your {slides.length} current slides with the imported deck?</span>
            <Button size="sm" onClick={pick}>Choose file</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmReplace(false)}>Cancel</Button>
          </div>
        </Callout>
      )}
      {notice && !error && <Callout tone="info">{notice}</Callout>}
      {error && <Callout tone="critical">{error}</Callout>}

      {slides.map((s, i) => (
        <Card key={s.id} tone="sunken" padding="sm" className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-caption font-semibold text-text-muted">S{i + 1}</span>
            <Input
              value={s.title}
              maxLength={PRESENTATION_LIMITS.slideTitle}
              onChange={(e) => update(s.id, { title: e.target.value })}
              placeholder="Slide title"
              aria-label={`Slide ${i + 1} title`}
            />
            <IconButton
              icon="trash-2"
              label={`Remove slide ${i + 1}`}
              onClick={() => onChange(slides.filter((x) => x.id !== s.id))}
            />
          </div>
          <Textarea
            value={s.notes}
            rows={3}
            maxLength={PRESENTATION_LIMITS.slideNotes}
            onChange={(e) => update(s.id, { notes: e.target.value })}
            placeholder="(no notes) — add the talking points for this slide"
            aria-label={`Slide ${i + 1} notes`}
          />
        </Card>
      ))}

      {slides.length < PRESENTATION_LIMITS.slidesMax && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange([...slides, { id: newId(), title: "", notes: "" }])}
        >
          Add slide
        </Button>
      )}
    </div>
  );
}
