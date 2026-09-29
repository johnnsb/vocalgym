"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { ACCEPTED_UPLOAD, extractScriptText } from "@/lib/scriptImport";
import { reportClientError } from "@/lib/clientErrors";
import { newId } from "@/lib/practiceStore";
import { PREP_LIMITS, emptyPanelist } from "@/lib/interviewPrep";
import type { InterviewPanelist, InterviewPrepState } from "@/lib/types";
import { Button, Callout, Card, Field, IconButton, Input, Textarea } from "@/components/ui";

// Controlled setup form for /prep/interview. Saving is the parent's job
// (InterviewSession debounces PUT /api/interview-prep on every change).

interface Props {
  value: InterviewPrepState;
  onChange: (next: InterviewPrepState) => void;
}

/** "or [Upload a file] .txt, .md, or .pdf" — fills a textarea from a file. */
function UploadInto({
  onText,
  area,
}: {
  onText: (text: string, note: string) => void;
  area: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { text, truncated } = await extractScriptText(file);
      onText(
        text,
        `Imported “${file.name}”${truncated ? " — trimmed to the first 8,000 characters" : ""}.`,
      );
    } catch (err) {
      reportClientError(err, { area });
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-caption text-text-muted">or</span>
        <Button
          variant="secondary"
          size="sm"
          icon="upload"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          {busy ? "Reading…" : "Upload a file"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_UPLOAD}
          onChange={handle}
          className="hidden"
        />
        <span className="text-caption text-text-muted">.txt, .md, or .pdf</span>
      </div>
      {error && <Callout tone="critical">{error}</Callout>}
    </div>
  );
}

function PanelistCard({
  p,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  p: InterviewPanelist;
  index: number;
  canRemove: boolean;
  onChange: (next: InterviewPanelist) => void;
  onRemove: () => void;
}) {
  const [note, setNote] = useState<string | null>(null);
  const set = (field: keyof InterviewPanelist) => (v: string) =>
    onChange({ ...p, [field]: v });
  const idp = `panelist-${p.id}`;

  return (
    <Card tone="sunken" className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-h4 text-text-primary">Interviewer {index + 1}</h3>
        {canRemove && (
          <IconButton icon="x" label={`Remove interviewer ${index + 1}`} onClick={onRemove} />
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name" htmlFor={`${idp}-name`}>
          <Input
            id={`${idp}-name`}
            value={p.name}
            maxLength={PREP_LIMITS.short}
            onChange={(e) => set("name")(e.target.value)}
            placeholder="Priya Shah"
          />
        </Field>
        <Field label="Title" htmlFor={`${idp}-title`}>
          <Input
            id={`${idp}-title`}
            value={p.title}
            maxLength={PREP_LIMITS.short}
            onChange={(e) => set("title")(e.target.value)}
            placeholder="VP Engineering"
          />
        </Field>
        <Field label="Company" htmlFor={`${idp}-company`}>
          <Input
            id={`${idp}-company`}
            value={p.company}
            maxLength={PREP_LIMITS.short}
            onChange={(e) => set("company")(e.target.value)}
            placeholder="Acme"
          />
        </Field>
      </div>
      <Field
        label="What do you know about them?"
        htmlFor={`${idp}-about`}
        hint="Anything helps: their LinkedIn profile (paste the text, or upload LinkedIn's “Save to PDF”), things they've written, where they've worked, what they care about."
      >
        <Textarea
          id={`${idp}-about`}
          value={p.about}
          rows={6}
          maxLength={PREP_LIMITS.about}
          onChange={(e) => set("about")(e.target.value)}
        />
        <UploadInto
          area="interview:upload-about"
          onText={(text, n) => {
            set("about")(text);
            setNote(n);
          }}
        />
        {note && <Callout tone="info">{note}</Callout>}
      </Field>
      <Field
        label="Questions they've asked before"
        htmlFor={`${idp}-past`}
        hint="From Glassdoor, a recruiter, or a friend who interviewed there. Optional."
      >
        <Textarea
          id={`${idp}-past`}
          value={p.pastQuestions}
          rows={3}
          maxLength={PREP_LIMITS.pastQuestions}
          onChange={(e) => set("pastQuestions")(e.target.value)}
        />
      </Field>
    </Card>
  );
}

export default function PanelSetup({ value, onChange }: Props) {
  const [showYourSide, setShowYourSide] = useState(
    Boolean(
      value.candidate.jobDescription ||
        value.candidate.background ||
        value.candidate.keyPoints.length,
    ),
  );
  const { panel, candidate } = value;
  // Always show one empty key-point input below the filled ones (up to 5).
  const keyPointInputs =
    candidate.keyPoints.length < PREP_LIMITS.keyPointsMax
      ? [...candidate.keyPoints, ""]
      : candidate.keyPoints;

  const setPanel = (next: InterviewPanelist[]) => onChange({ ...value, panel: next });
  const setCandidate = (patch: Partial<InterviewPrepState["candidate"]>) =>
    onChange({ ...value, candidate: { ...candidate, ...patch } });

  function setKeyPoint(i: number, text: string) {
    const next = [...keyPointInputs];
    next[i] = text;
    // Blank entries are dropped; the trailing empty input is re-added on render.
    setCandidate({ keyPoints: next.filter((k) => k.trim() !== "") });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div>
          <h2 className="text-h4 text-text-primary">Your panel</h2>
          <p className="mt-1 text-body-sm text-text-muted">
            Who&apos;s across the table? Add up to {PREP_LIMITS.panelMax} people.
          </p>
        </div>
        {panel.map((p, i) => (
          <PanelistCard
            key={p.id}
            p={p}
            index={i}
            canRemove={panel.length > 1}
            onChange={(next) => setPanel(panel.map((x) => (x.id === p.id ? next : x)))}
            onRemove={() => setPanel(panel.filter((x) => x.id !== p.id))}
          />
        ))}
        {panel.length < PREP_LIMITS.panelMax && (
          <Button
            variant="secondary"
            onClick={() => setPanel([...panel, emptyPanelist(newId())])}
          >
            Add interviewer
          </Button>
        )}
      </section>

      <section className="space-y-4">
        <Button
          variant="ghost"
          iconAfter={showYourSide ? "chevron-down" : "chevron-right"}
          onClick={() => setShowYourSide((s) => !s)}
        >
          Your side (optional)
        </Button>
        {showYourSide && (
          <Card tone="sunken" className="space-y-4">
            <Field
              label="Job description"
              htmlFor="jd"
              hint="Paste the posting — questions will target what it asks for."
            >
              <Textarea
                id="jd"
                value={candidate.jobDescription}
                rows={5}
                maxLength={PREP_LIMITS.jobDescription}
                onChange={(e) => setCandidate({ jobDescription: e.target.value })}
              />
              <UploadInto
                area="interview:upload-jd"
                onText={(text) => setCandidate({ jobDescription: text })}
              />
            </Field>
            <Field
              label="Your resume or background"
              htmlFor="background"
              hint="Feedback can point out a stronger example you didn't use."
            >
              <Textarea
                id="background"
                value={candidate.background}
                rows={5}
                maxLength={PREP_LIMITS.background}
                onChange={(e) => setCandidate({ background: e.target.value })}
              />
              <UploadInto
                area="interview:upload-background"
                onText={(text) => setCandidate({ background: text })}
              />
            </Field>
            <Field
              label="Key points you want to land"
              hint={`Up to ${PREP_LIMITS.keyPointsMax}. Feedback checks whether they came through.`}
            >
              <div className="space-y-2">
                {keyPointInputs.map((k, i) => (
                  <Input
                    key={i}
                    value={k}
                    maxLength={PREP_LIMITS.keyPoint}
                    onChange={(e) => setKeyPoint(i, e.target.value)}
                    placeholder={i === 0 ? "I led the payments migration end to end" : ""}
                    aria-label={`Key point ${i + 1}`}
                  />
                ))}
              </div>
            </Field>
          </Card>
        )}
      </section>
    </div>
  );
}
