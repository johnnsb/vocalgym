"use client";

import type { FormEvent } from "react";
import { TONES, TONE_LABELS, type Tone } from "@/lib/types";
import { Button, Card, Field, Select, Textarea } from "@/components/ui";

const QUICK_STARTS: { label: string; text: string }[] = [
  {
    label: "Asking my boss for a raise",
    text: "I want to ask my manager for a raise. I've taken on more responsibility over the past year and my pay hasn't kept up, and I want to make the case without sounding entitled.",
  },
  {
    label: "Difficult conversation with my daughter",
    text: "I need to talk with my teenage daughter about her slipping grades. I want to understand what's going on and agree on a plan, without her shutting down or feeling attacked.",
  },
  {
    label: "Pitching investors",
    text: "I'm pitching my startup to a group of investors next week. In a few minutes I need to lay out the problem, our solution, and why now is the right time — clearly and confidently.",
  },
  {
    label: "Giving a wedding toast",
    text: "I'm the best man giving a toast at my friend's wedding. I want it to be warm and a little funny, land one heartfelt moment, and not run too long.",
  },
];

interface Props {
  situation: string;
  tone: Tone | "";
  loading: boolean;
  onSituationChange: (value: string) => void;
  onToneChange: (value: Tone | "") => void;
  onSubmit: (e: FormEvent) => void;
}

export default function ScriptForm({
  situation,
  tone,
  loading,
  onSituationChange,
  onToneChange,
  onSubmit,
}: Props) {
  return (
    <Card as="form" onSubmit={onSubmit} className="space-y-field">
      <Field label="What's the situation?" htmlFor="situation">
        <Textarea
          id="situation"
          value={situation}
          onChange={(e) => onSituationChange(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="e.g. I need to have a difficult conversation with my daughter about her grades"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-caption text-text-muted">Try an example:</span>
          {QUICK_STARTS.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => onSituationChange(q.text)}
              disabled={loading}
              className="rounded-pill border border-border-default bg-surface-card px-3 py-1 text-caption font-medium text-text-body transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {q.label}
            </button>
          ))}
        </div>
      </Field>

      <Field
        label={
          <>
            Tone / context{" "}
            <span className="font-normal text-text-muted">(optional)</span>
          </>
        }
        htmlFor="tone"
      >
        <Select
          id="tone"
          value={tone}
          onChange={(e) => onToneChange(e.target.value as Tone | "")}
        >
          <option value="">No preference</option>
          {TONES.map((t) => (
            <option key={t} value={t}>
              {TONE_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>

      <Button type="submit" disabled={loading || !situation.trim()}>
        {loading ? "Generating…" : "Generate script"}
      </Button>
    </Card>
  );
}
