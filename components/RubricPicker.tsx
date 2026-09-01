"use client";

import { useEffect, useState } from "react";
import {
  RUBRIC_ATTRIBUTES,
  TONE_LABELS,
  type RubricAttribute,
  type RubricSelection,
  type Tone,
} from "@/lib/types";
import { ATTRIBUTE_RUBRIC, normalizeSelection, rubricPreset } from "@/lib/rubric";
import { loadState, saveRubric, TONE_CHANGE_EVENT } from "@/lib/practiceStore";
import { reportClientError } from "@/lib/clientErrors";
import { Card } from "@/components/ui";

const MAX = 4;

function distribute(attrs: RubricAttribute[]): Record<string, number> {
  const w: Record<string, number> = {};
  if (!attrs.length) return w;
  const base = Math.floor(100 / attrs.length);
  attrs.forEach((a, i) => {
    w[a] = i === attrs.length - 1 ? 100 - base * (attrs.length - 1) : base;
  });
  return w;
}

export default function RubricPicker() {
  const [hydrated, setHydrated] = useState(false);
  const [tone, setTone] = useState<Tone | "">("");
  const [sel, setSel] = useState<RubricSelection>(() => rubricPreset(""));

  useEffect(() => {
    let cancelled = false;

    const onTone = (e: Event) => {
      const d = (e as CustomEvent).detail;
      setTone(typeof d === "string" ? (d as Tone | "") : "");
    };
    window.addEventListener(TONE_CHANGE_EVENT, onTone);

    loadState()
      .then((state) => {
        if (cancelled) return;
        const t = state.currentScript?.tone ?? "";
        setTone(t);
        setSel(
          state.rubric?.custom
            ? normalizeSelection(state.rubric)
            : rubricPreset(t),
        );
      })
      .catch((err) => reportClientError(err, { area: "rubric:hydrate" }))
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });

    return () => {
      cancelled = true;
      window.removeEventListener(TONE_CHANGE_EVENT, onTone);
    };
  }, []);

  // Retune to the tone's preset whenever the tone changes — unless the user has
  // taken over with a hand-edited rubric.
  useEffect(() => {
    if (!hydrated) return;
    setSel((prev) => {
      if (prev.custom) return prev;
      const next = rubricPreset(tone);
      persistRubric(next);
      return next;
    });
  }, [tone, hydrated]);

  function persistRubric(next: RubricSelection) {
    void saveRubric(next).catch((err) =>
      reportClientError(err, { area: "rubric:save" }),
    );
  }

  function commit(next: RubricSelection) {
    setSel(next);
    persistRubric(next);
  }

  function toggle(attr: RubricAttribute) {
    const on = sel.attributes.includes(attr);
    let attributes: RubricAttribute[];
    if (on) {
      attributes = sel.attributes.filter((a) => a !== attr);
    } else {
      if (sel.attributes.length >= MAX) return;
      attributes = [...sel.attributes, attr];
    }
    commit({ attributes, weights: distribute(attributes), custom: true });
  }

  function move(attr: RubricAttribute, dir: -1 | 1) {
    const i = sel.attributes.indexOf(attr);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sel.attributes.length) return;
    const attributes = [...sel.attributes];
    [attributes[i], attributes[j]] = [attributes[j], attributes[i]];
    commit({ ...sel, attributes, custom: true });
  }

  function setWeight(attr: RubricAttribute, raw: string) {
    const n = Math.max(0, Math.min(100, Math.round(Number(raw) || 0)));
    commit({ ...sel, weights: { ...sel.weights, [attr]: n }, custom: true });
  }

  const toneLabel = tone ? TONE_LABELS[tone] : "balanced";
  const total = sel.attributes.reduce((s, a) => s + (sel.weights[a] || 0), 0);

  return (
    <Card as="section" padding="lg">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-h4 text-text-primary">
          What does &ldquo;effective&rdquo; mean here?
        </h2>
        {sel.custom && (
          <button
            type="button"
            onClick={() => commit(rubricPreset(tone))}
            className="text-caption text-text-muted underline underline-offset-2 hover:text-text-body"
          >
            Use the {toneLabel} preset
          </button>
        )}
      </div>

      <p className="mb-4 text-body-sm leading-relaxed text-text-body">
        {sel.custom ? (
          <>
            Custom — you&apos;ve set this by hand. Every take is scored as one{" "}
            <strong className="text-text-primary">Effective</strong> number
            against these.
          </>
        ) : tone ? (
          <>
            Tuned for a{" "}
            <strong className="text-text-primary">{toneLabel}</strong>{" "}
            conversation. Every take is scored as one{" "}
            <strong className="text-text-primary">Effective</strong> number
            against these — adjust anything to make it your own.
          </>
        ) : (
          <>
            A <strong className="text-text-primary">balanced</strong> default (no
            tone picked). Every take is scored as one{" "}
            <strong className="text-text-primary">Effective</strong> number
            against these — adjust anything to make it your own.
          </>
        )}
      </p>

      <div className="flex flex-wrap gap-2">
        {RUBRIC_ATTRIBUTES.map((attr) => {
          const on = sel.attributes.includes(attr);
          const full = !on && sel.attributes.length >= MAX;
          return (
            <button
              key={attr}
              type="button"
              onClick={() => toggle(attr)}
              disabled={full || !hydrated}
              title={ATTRIBUTE_RUBRIC[attr].blurb}
              className={`rounded-pill border px-3 py-1.5 text-body-sm font-medium transition-colors ${
                on
                  ? "border-ink bg-ink text-text-inverse"
                  : "border-border-default text-text-body hover:bg-surface-hover"
              } ${full ? "cursor-not-allowed opacity-40" : ""}`}
            >
              {on ? "✓ " : ""}
              {ATTRIBUTE_RUBRIC[attr].label}
            </button>
          );
        })}
      </div>

      {sel.attributes.length > 0 && (
        <div className="mt-5 space-y-2">
          {sel.attributes.map((attr, i) => (
            <div
              key={attr}
              className="flex items-center gap-3 rounded-md border border-border-subtle bg-surface-sunken px-3 py-2"
            >
              <span className="w-4 text-center text-caption font-semibold text-text-muted">
                {i + 1}
              </span>
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => move(attr, -1)}
                  disabled={i === 0}
                  className="text-text-muted hover:text-text-primary disabled:opacity-25"
                  aria-label={`Move ${attr} up`}
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => move(attr, 1)}
                  disabled={i === sel.attributes.length - 1}
                  className="text-text-muted hover:text-text-primary disabled:opacity-25"
                  aria-label={`Move ${attr} down`}
                >
                  ▼
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-body-sm font-medium text-text-primary">
                  {ATTRIBUTE_RUBRIC[attr].label}
                </div>
                <div className="truncate text-caption text-text-muted">
                  {ATTRIBUTE_RUBRIC[attr].blurb}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={sel.weights[attr] ?? 0}
                  onChange={(e) => setWeight(attr, e.target.value)}
                  className="w-14 rounded-control border border-border-default bg-surface-card px-2 py-1 text-right text-body-sm tabular-nums focus:border-ember focus:outline-none"
                />
                <span className="text-body-sm text-text-muted">%</span>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-1 text-caption">
            <button
              type="button"
              onClick={() =>
                commit({
                  ...sel,
                  weights: distribute(sel.attributes),
                  custom: true,
                })
              }
              className="text-text-muted underline underline-offset-2 hover:text-text-primary"
            >
              Distribute evenly
            </button>
            <span
              className={
                total === 100 ? "text-status-positive" : "text-text-accent"
              }
            >
              Total: {total}%{total !== 100 && " — will be scaled to 100%"}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
