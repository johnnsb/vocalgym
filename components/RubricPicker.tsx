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
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">
          What does &ldquo;effective&rdquo; mean here?
        </h2>
        {sel.custom && (
          <button
            type="button"
            onClick={() => commit(rubricPreset(tone))}
            className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600"
          >
            Use the {toneLabel} preset
          </button>
        )}
      </div>

      <p className="mb-4 text-sm leading-relaxed text-slate-600">
        {sel.custom ? (
          <>
            Custom — you&apos;ve set this by hand. Every take is scored as one{" "}
            <strong>Effective</strong> number against these.
          </>
        ) : tone ? (
          <>
            Tuned for a <strong>{toneLabel}</strong> conversation. Every take is
            scored as one <strong>Effective</strong> number against these — adjust
            anything to make it your own.
          </>
        ) : (
          <>
            A <strong>balanced</strong> default (no tone picked). Every take is
            scored as one <strong>Effective</strong> number against these — adjust
            anything to make it your own.
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
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                on
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
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
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <span className="w-4 text-center text-xs font-semibold text-slate-400">
                {i + 1}
              </span>
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => move(attr, -1)}
                  disabled={i === 0}
                  className="text-slate-400 hover:text-slate-700 disabled:opacity-25"
                  aria-label={`Move ${attr} up`}
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => move(attr, 1)}
                  disabled={i === sel.attributes.length - 1}
                  className="text-slate-400 hover:text-slate-700 disabled:opacity-25"
                  aria-label={`Move ${attr} down`}
                >
                  ▼
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-800">
                  {ATTRIBUTE_RUBRIC[attr].label}
                </div>
                <div className="truncate text-xs text-slate-500">
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
                  className="w-14 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
                <span className="text-sm text-slate-400">%</span>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-1 text-xs">
            <button
              type="button"
              onClick={() =>
                commit({
                  ...sel,
                  weights: distribute(sel.attributes),
                  custom: true,
                })
              }
              className="text-slate-500 underline underline-offset-2 hover:text-slate-800"
            >
              Distribute evenly
            </button>
            <span className={total === 100 ? "text-emerald-600" : "text-amber-600"}>
              Total: {total}%{total !== 100 && " — will be scaled to 100%"}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
