"use client";

import { useRef, useState, type ChangeEvent } from "react";
import SlideListEditor from "./SlideListEditor";
import { ACCEPTED_UPLOAD, extractScriptText } from "@/lib/scriptImport";
import { reportClientError } from "@/lib/clientErrors";
import { PRESENTATION_LIMITS } from "@/lib/presentationPrep";
import type { PresentationPrep } from "@/lib/types";
import { Button, Callout, Card, Field, Input, Tabs, Textarea } from "@/components/ui";

// Controlled setup form for /prep/presentation. Saving is the parent's job.

interface Props {
  value: PresentationPrep;
  onChange: (next: PresentationPrep) => void;
}

export default function PresentationSetup({ value, onChange }: Props) {
  const set = (patch: Partial<PresentationPrep>) => onChange({ ...value, ...patch });
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleNotesFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { text, truncated } = await extractScriptText(file);
      set({ notes: text });
      setNote(`Imported “${file.name}”${truncated ? " — trimmed to the first 8,000 characters" : ""}.`);
    } catch (err) {
      reportClientError(err, { area: "presentation:notes-upload" });
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <Field label="Talk title" htmlFor="talk-title" hint="Optional — shows up in your run history.">
          <Input
            id="talk-title"
            value={value.title}
            maxLength={PRESENTATION_LIMITS.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="Q3 business review"
          />
        </Field>

        <Tabs
          value={value.mode}
          onChange={(v: string) => set({ mode: v === "slides" ? "slides" : "notes" })}
          tabs={[
            { value: "notes", label: "Notes" },
            { value: "slides", label: "Slides" },
          ]}
        />

        {value.mode === "notes" ? (
          <Field
            label="Speaker notes or talking points"
            htmlFor="talk-notes"
            hint="What you plan to cover — bullets are fine. You won't be graded on exact wording."
          >
            <Textarea
              id="talk-notes"
              value={value.notes}
              rows={10}
              maxLength={PRESENTATION_LIMITS.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-caption text-text-muted">or</span>
              <Button variant="secondary" size="sm" icon="upload" onClick={() => fileRef.current?.click()} disabled={busy}>
                {busy ? "Reading…" : "Upload a file"}
              </Button>
              <input ref={fileRef} type="file" accept={ACCEPTED_UPLOAD} onChange={handleNotesFile} className="hidden" />
              <span className="text-caption text-text-muted">.txt, .md, or .pdf</span>
            </div>
            {note && !error && <Callout tone="info">{note}</Callout>}
            {error && <Callout tone="critical">{error}</Callout>}
          </Field>
        ) : (
          <SlideListEditor slides={value.slides} onChange={(slides) => set({ slides })} />
        )}
      </Card>

      <Card tone="sunken" className="space-y-4">
        <Field
          label="Who's in the room?"
          htmlFor="talk-audience"
          hint="Optional — e.g. “exec team; the CFO cares about cost”. Shapes the feedback."
        >
          <Textarea
            id="talk-audience"
            value={value.audience}
            rows={2}
            maxLength={PRESENTATION_LIMITS.audience}
            onChange={(e) => set({ audience: e.target.value })}
          />
        </Field>
        <Field label="Time limit (minutes)" htmlFor="talk-limit" hint="Optional.">
          <Input
            id="talk-limit"
            type="number"
            min={PRESENTATION_LIMITS.timeLimitMinMin}
            max={PRESENTATION_LIMITS.timeLimitMinMax}
            value={value.timeLimitMin ?? ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              set({
                timeLimitMin:
                  e.target.value === "" || !Number.isFinite(n) || n < 1 || n > 120 ? null : Math.round(n),
              });
            }}
            style={{ maxWidth: 120 }}
          />
        </Field>
      </Card>
    </div>
  );
}
