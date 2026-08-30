import type {
  AudioSummary,
  EffectiveResult,
  NonverbalMetrics,
  ObservableSignals,
  RubricAttribute,
  RubricSelection,
  Tone,
} from "./types";
import { RUBRIC_ATTRIBUTES, TONE_LABELS } from "./types";

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

type SignalKey = keyof ObservableSignals;

export const SIGNAL_LABELS: Record<SignalKey, string> = {
  eyeContact: "eye contact",
  posture: "posture",
  stillness: "stillness",
  expressiveness: "expressiveness",
  composure: "composure",
  volume: "volume",
  steadiness: "voice steadiness",
  fluency: "fluency",
  pace: "pace",
};

/**
 * The generic rubric: each aspirational attribute is a weighted blend of the
 * observable signals we can measure from a take. Weights within an attribute are
 * relative and get renormalised over whatever signals are actually available.
 */
export const ATTRIBUTE_RUBRIC: Record<
  RubricAttribute,
  { label: string; blurb: string; signals: Partial<Record<SignalKey, number>> }
> = {
  connected: {
    label: "Connected",
    blurb: "Relating to the other person, not just reciting.",
    signals: { eyeContact: 0.5, expressiveness: 0.3, composure: 0.2 },
  },
  present: {
    label: "Present",
    blurb: "Grounded and engaged — not checked out or rushing.",
    signals: { eyeContact: 0.35, posture: 0.25, stillness: 0.2, composure: 0.2 },
  },
  smooth: {
    label: "Smooth",
    blurb: "Fluent, unhurried delivery.",
    signals: { fluency: 0.45, pace: 0.3, steadiness: 0.25 },
  },
  composed: {
    label: "Composed",
    blurb: "Calm under pressure.",
    signals: { composure: 0.4, stillness: 0.35, steadiness: 0.25 },
  },
  warm: {
    label: "Warm",
    blurb: "Approachable and human.",
    signals: { expressiveness: 0.55, eyeContact: 0.25, volume: 0.2 },
  },
  confident: {
    label: "Confident",
    blurb: "Settled and sure of the ask.",
    signals: { posture: 0.3, volume: 0.25, fluency: 0.25, eyeContact: 0.2 },
  },
  grounded: {
    label: "Grounded",
    blurb: "Physically still and settled.",
    signals: { posture: 0.5, stillness: 0.5 },
  },
  clear: {
    label: "Clear",
    blurb: "Easy to follow and to hear.",
    signals: { volume: 0.4, pace: 0.35, fluency: 0.25 },
  },
};

type Preset = { attributes: RubricAttribute[]; weights: Record<string, number> };

/**
 * What "effective" means for each tone/context. Attributes are stack-ranked
 * (array order) with percentage weights that sum to 100. `generic` is the
 * default when no tone is chosen. Every preset includes at least one quality
 * that can be scored without the camera (Smooth or Clear).
 */
export const TONE_RUBRIC_PRESETS: Record<Tone | "generic", Preset> = {
  generic: {
    attributes: ["connected", "present", "clear", "composed"],
    weights: { connected: 30, present: 25, clear: 25, composed: 20 },
  },
  professional: {
    // measured and credible with colleagues or clients
    attributes: ["clear", "confident", "composed", "smooth"],
    weights: { clear: 30, confident: 25, composed: 25, smooth: 20 },
  },
  personal: {
    // a person they care about — relationship over transaction
    attributes: ["connected", "warm", "present", "smooth"],
    weights: { connected: 35, warm: 25, present: 20, smooth: 20 },
  },
  "high-stakes": {
    // hold it together and make the message land under pressure
    attributes: ["composed", "clear", "confident", "present"],
    weights: { composed: 35, clear: 25, confident: 20, present: 20 },
  },
  supportive: {
    // the other person may be anxious or hurting — be a steady, warm presence
    attributes: ["warm", "connected", "present", "smooth"],
    weights: { warm: 35, connected: 25, present: 20, smooth: 20 },
  },
  persuasive: {
    // a clear ask, carried with conviction
    attributes: ["confident", "clear", "connected", "smooth"],
    weights: { confident: 30, clear: 30, connected: 20, smooth: 20 },
  },
  celebratory: {
    // upbeat and sincere, and let it flow
    attributes: ["warm", "connected", "present", "smooth"],
    weights: { warm: 40, connected: 30, present: 15, smooth: 15 },
  },
};

/** A fresh, tone-tuned selection. Empty/unknown tone -> the generic preset. */
export function rubricPreset(
  tone: Tone | "" | null | undefined,
): RubricSelection {
  const key: Tone | "generic" =
    tone && tone in TONE_RUBRIC_PRESETS ? (tone as Tone) : "generic";
  const preset = TONE_RUBRIC_PRESETS[key];
  return {
    attributes: [...preset.attributes],
    weights: { ...preset.weights },
    custom: false,
  };
}

export const DEFAULT_SELECTION: RubricSelection = rubricPreset("");

const FILLERS_HARD = /\b(u+m+|u+h+|e+r+m*|hm+)\b/gi;
const FILLERS_SOFT =
  /\b(like|you know|i mean|i guess|sort of|kind of|kinda|basically)\b/gi;

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

function paceScore(wpm: number): number | null {
  if (!Number.isFinite(wpm) || wpm <= 0) return null;
  if (wpm >= 110 && wpm <= 155) return 100;
  if (wpm < 110) return Math.round(clamp(100 - (110 - wpm) * 1.3, 20, 100));
  return Math.round(clamp(100 - (wpm - 155) * 1.1, 20, 100));
}

export interface SignalInput {
  nonverbal: NonverbalMetrics | null;
  audio: AudioSummary | null;
  transcript: string;
  durationSec: number;
}

export function computeSignals(input: SignalInput): ObservableSignals {
  const { nonverbal: nv, audio, transcript, durationSec } = input;

  const words = transcript.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const haveText = wordCount >= 6;

  let fluency: number | null = null;
  let pace: number | null = null;
  if (haveText) {
    const fillers =
      countMatches(transcript, FILLERS_HARD) +
      0.6 * countMatches(transcript, FILLERS_SOFT);
    fluency = Math.round(clamp(100 - (fillers / wordCount) * 700, 0, 100));
    pace = durationSec > 0 ? paceScore((wordCount / durationSec) * 60) : null;
  }

  let expressiveness: number | null = null;
  let composure: number | null = null;
  if (nv) {
    const p = nv.expressiveness.smilePresentPct;
    let e = 45 + p * 1.4;
    if (p > 65) e -= (p - 65) * 1.6;
    expressiveness = Math.round(clamp(e, 0, 100));
    composure = Math.round(
      clamp(100 - nv.expressiveness.browTensionPct * 1.5, 0, 100),
    );
  }

  return {
    eyeContact: nv ? Math.round(nv.eyeContact.facingForwardPct) : null,
    posture: nv ? Math.round(nv.posture.uprightPct) : null,
    stillness: nv ? Math.round(nv.posture.stillnessScore) : null,
    expressiveness,
    composure,
    volume: audio ? audio.comfortablePct : null,
    steadiness: audio ? audio.steadinessPct : null,
    fluency,
    pace,
  };
}

export function scoreAttribute(
  attribute: RubricAttribute,
  signals: ObservableSignals,
): { score: number | null; used: SignalKey[]; missing: SignalKey[] } {
  const map = ATTRIBUTE_RUBRIC[attribute].signals;
  const used: SignalKey[] = [];
  const missing: SignalKey[] = [];
  let acc = 0;
  let wsum = 0;
  for (const key of Object.keys(map) as SignalKey[]) {
    const w = map[key] ?? 0;
    const v = signals[key];
    if (v == null) {
      missing.push(key);
      continue;
    }
    acc += v * w;
    wsum += w;
    used.push(key);
  }
  return wsum > 0
    ? { score: Math.round(acc / wsum), used, missing }
    : { score: null, used, missing };
}

export function effectiveLabel(n: number): string {
  if (n >= 82) return "Dialed in";
  if (n >= 66) return "Solid";
  if (n >= 48) return "Getting there";
  return "Rough";
}

const SIGNAL_KEYS = Object.keys(SIGNAL_LABELS) as SignalKey[];

/** Defensive parse of a client-supplied signals blob. */
export function coerceSignals(raw: unknown): ObservableSignals | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out = {} as ObservableSignals;
  let any = false;
  for (const key of SIGNAL_KEYS) {
    const v = r[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      out[key] = clamp(Math.round(v), 0, 100);
      any = true;
    } else {
      out[key] = null;
    }
  }
  return any ? out : null;
}

/** Coerce a possibly-messy selection to something usable; empty -> the default. */
export function normalizeSelection(
  raw: RubricSelection | null | undefined,
): RubricSelection {
  const custom = raw?.custom === true;
  const attrs = (raw?.attributes ?? [])
    .filter((a): a is RubricAttribute =>
      (RUBRIC_ATTRIBUTES as readonly string[]).includes(a),
    )
    .slice(0, 4);
  if (attrs.length === 0) return DEFAULT_SELECTION;

  const weights: Record<string, number> = {};
  let total = 0;
  for (const a of attrs) {
    const w =
      typeof raw?.weights?.[a] === "number" && raw.weights[a] > 0
        ? raw.weights[a]
        : 0;
    weights[a] = w;
    total += w;
  }
  if (total <= 0) {
    const even = Math.floor(100 / attrs.length);
    attrs.forEach((a, i) => {
      weights[a] = i === attrs.length - 1 ? 100 - even * (attrs.length - 1) : even;
    });
  } else {
    // scale to 100
    for (const a of attrs) weights[a] = Math.round((weights[a] / total) * 100);
  }
  return { attributes: attrs, weights, custom };
}

export function computeEffective(
  selection: RubricSelection | null | undefined,
  signals: ObservableSignals,
): EffectiveResult {
  const sel = normalizeSelection(selection);
  const rows = sel.attributes.map((attribute) => {
    const { score, used, missing } = scoreAttribute(attribute, signals);
    return {
      attribute,
      label: ATTRIBUTE_RUBRIC[attribute].label,
      weight: sel.weights[attribute] ?? 0,
      score,
      usedSignals: used.map((k) => SIGNAL_LABELS[k]),
      missingSignals: missing.map((k) => SIGNAL_LABELS[k]),
    };
  });

  const scored = rows.filter((r) => r.score !== null);
  const wsum = scored.reduce((s, r) => s + r.weight, 0) || 1;
  const score = Math.round(
    scored.reduce((s, r) => s + (r.score as number) * r.weight, 0) / wsum,
  );

  return {
    score,
    label: effectiveLabel(score),
    rows,
    coverage: rows.length ? scored.length / rows.length : 0,
  };
}

/** Feedback-prompt block. Kept qualitative so the model coaches, not recites. */
export function formatRubricForPrompt(
  effective: EffectiveResult,
  signals: ObservableSignals,
  opts: { tone?: Tone | "" | null; custom?: boolean } = {},
): string {
  const intro = opts.custom
    ? "The user hand-picked which qualities define an effective delivery here, highest priority first:"
    : opts.tone
      ? `For a ${TONE_LABELS[opts.tone]} conversation, an effective delivery here is scored on these qualities, highest priority first:`
      : "Effectiveness here is scored on a balanced default set of qualities, highest priority first:";
  const lines = [
    'EFFECTIVENESS RUBRIC — computed in the browser from this one take; numbers are rough estimates, not exact.',
    intro,
  ];
  for (const r of effective.rows) {
    const from = r.usedSignals.length
      ? ` (from ${r.usedSignals.join(", ")})`
      : "";
    lines.push(
      r.score === null
        ? `- ${r.label} — weight ${r.weight}% — not scored this take (missing ${r.missingSignals.join(", ")})`
        : `- ${r.label} — weight ${r.weight}% — scored ${r.score}/100${from}`,
    );
  }
  const sig = (k: SignalKey) =>
    signals[k] === null ? null : `${SIGNAL_LABELS[k]} ${signals[k]}`;
  const readout = (Object.keys(SIGNAL_LABELS) as SignalKey[])
    .map(sig)
    .filter(Boolean)
    .join(", ");
  lines.push(
    `Overall "Effective" score: ${effective.score}/100 — "${effective.label}".`,
    readout ? `Signal readout (0–100): ${readout}.` : "",
    'In "Overall", state the Effective score and name the highest-weighted quality that scored lowest. In "For your next take", prioritise fixes for that quality. Translate the numbers into concrete behaviour — never reproduce them as a list or table.',
  );
  return lines.filter(Boolean).join("\n");
}
