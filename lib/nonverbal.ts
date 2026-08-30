import type { NonverbalMetrics, NonverbalSpan } from "./types";

/**
 * One webcam sample taken roughly every 500ms during a recording. Angles are in
 * degrees, 0 = neutral. All of this is computed in the browser and reduced to a
 * {@link NonverbalMetrics} summary before anything is sent anywhere.
 */
export interface NonverbalRawSample {
  t: number; // ms since recording start
  face: boolean;
  yaw: number; // head turn L/R
  pitch: number; // head up/down (+ = looking down)
  roll: number; // head tilt (+ = image-right side down)
  gaze: number; // 0..1 eye-look-away magnitude
  facingForward: boolean;
  smile: number; // 0..1
  brow: number; // 0..1 tension
  faceArea: number; // normalized bounding-box area
  pose: boolean;
  shoulderAngle: number | null; // deg from horizontal, 0 = level
  headOffsetX: number | null; // nose.x - shoulder midpoint x (normalized)
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

const round = (n: number, digits = 0) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

const mean = (a: number[]) =>
  a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;

function median(a: number[]): number {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function findSpans(
  samples: NonverbalRawSample[],
  predicate: (s: NonverbalRawSample) => boolean,
  minDurSec: number,
): NonverbalSpan[] {
  const spans: NonverbalSpan[] = [];
  let start: number | null = null;
  let last = 0;
  for (const s of samples) {
    if (predicate(s)) {
      if (start === null) start = s.t;
      last = s.t;
    } else if (start !== null) {
      if (last - start >= minDurSec * 1000) {
        spans.push({ startSec: round(start / 1000), endSec: round(last / 1000) });
      }
      start = null;
    }
  }
  if (start !== null && last - start >= minDurSec * 1000) {
    spans.push({ startSec: round(start / 1000), endSec: round(last / 1000) });
  }
  return spans.slice(0, 12);
}

export function summarizeNonverbal(
  samples: NonverbalRawSample[],
  durationMs: number,
): NonverbalMetrics {
  const n = samples.length || 1;
  const withFace = samples.filter((s) => s.face);
  const withPose = samples.filter(
    (s) => s.pose && s.shoulderAngle !== null,
  ) as (NonverbalRawSample & { shoulderAngle: number })[];

  // Eye contact
  const facingForwardPct = round(
    (100 * samples.filter((s) => s.facingForward).length) / n,
  );
  const awaySpans = findSpans(samples, (s) => !s.facingForward, 2);
  const longestAwaySec = awaySpans.reduce(
    (m, sp) => Math.max(m, sp.endSec - sp.startSec),
    0,
  );

  // Posture
  const medArea = median(withFace.map((s) => s.faceArea).filter((a) => a > 0));
  const leanForwardSpans =
    medArea > 0
      ? findSpans(samples, (s) => s.face && s.faceArea > medArea * 1.18, 2)
      : [];
  const avgRoll = mean(withFace.map((s) => s.roll));
  const headTilt: NonverbalMetrics["posture"]["headTilt"] =
    avgRoll > 6 ? "tilted right" : avgRoll < -6 ? "tilted left" : "level";
  const shoulderLevelPct = withPose.length
    ? round(
        (100 * withPose.filter((s) => Math.abs(s.shoulderAngle) < 7).length) /
          withPose.length,
      )
    : null;
  const uprightPct = round(
    (100 *
      samples.filter((s) => {
        const rollOk = s.face ? Math.abs(s.roll) < 10 : false;
        const shoulderOk =
          s.shoulderAngle !== null ? Math.abs(s.shoulderAngle) < 8 : true;
        return rollOk && shoulderOk;
      }).length) /
      n,
  );
  const offsets = samples
    .map((s) => s.headOffsetX)
    .filter((x): x is number => x !== null);
  const swayRange = offsets.length
    ? Math.max(...offsets) - Math.min(...offsets)
    : 0;
  const swayNote =
    swayRange > 0.13
      ? "noticeable side-to-side movement"
      : swayRange > 0.08
        ? "some shifting side to side"
        : null;
  const swayPenalty =
    swayRange > 0.13 ? 45 : swayRange > 0.08 ? 24 : swayRange > 0.05 ? 10 : 0;
  const stillnessScore = Math.max(
    0,
    100 - swayPenalty - Math.min(20, leanForwardSpans.length * 8),
  );

  // Expressiveness
  const smilePresentPct = withFace.length
    ? round((100 * withFace.filter((s) => s.smile > 0.35).length) / withFace.length)
    : 0;
  const avgSmileIntensity = round(
    mean(withFace.filter((s) => s.smile > 0.35).map((s) => s.smile)),
    2,
  );
  let smileCount = 0;
  let armed = true;
  for (const s of samples) {
    if (s.smile > 0.4 && armed) {
      smileCount += 1;
      armed = false;
    } else if (s.smile < 0.2) {
      armed = true;
    }
  }
  const browTensionPct = withFace.length
    ? round((100 * withFace.filter((s) => s.brow > 0.3).length) / withFace.length)
    : 0;
  const browTensionSpans = findSpans(samples, (s) => s.face && s.brow > 0.3, 2);

  return {
    durationSec: round(durationMs / 1000),
    samples: samples.length,
    faceDetectedPct: round((100 * withFace.length) / n),
    poseDetectedPct: round((100 * samples.filter((s) => s.pose).length) / n),
    eyeContact: {
      facingForwardPct,
      longestAwaySec: round(longestAwaySec),
      awaySpans,
    },
    posture: {
      uprightPct,
      headTilt,
      shoulderLevelPct,
      leanForwardSpans,
      swayNote,
      stillnessScore,
    },
    expressiveness: {
      smileCount,
      smilePresentPct,
      avgSmileIntensity,
      browTensionPct,
      browTensionSpans,
    },
  };
}

/** Defensive parse of a client-supplied metrics blob before it reaches the model. */
export function coerceNonverbal(raw: unknown): NonverbalMetrics | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const num = (v: unknown, lo: number, hi: number, def = 0) =>
    typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : def;

  const parseSpan = (v: unknown): NonverbalSpan | null => {
    if (!v || typeof v !== "object") return null;
    const s = v as Record<string, unknown>;
    if (typeof s.startSec !== "number" || typeof s.endSec !== "number") {
      return null;
    }
    return {
      startSec: clamp(s.startSec, 0, 100000),
      endSec: clamp(s.endSec, 0, 100000),
    };
  };
  const parseSpans = (v: unknown): NonverbalSpan[] =>
    Array.isArray(v)
      ? v
          .map(parseSpan)
          .filter((x): x is NonverbalSpan => x !== null)
          .slice(0, 20)
      : [];

  const ec = (r.eyeContact ?? {}) as Record<string, unknown>;
  const po = (r.posture ?? {}) as Record<string, unknown>;
  const ex = (r.expressiveness ?? {}) as Record<string, unknown>;
  const tilt = po.headTilt;

  return {
    durationSec: num(r.durationSec, 0, 100000),
    samples: num(r.samples, 0, 1_000_000),
    faceDetectedPct: num(r.faceDetectedPct, 0, 100),
    poseDetectedPct: num(r.poseDetectedPct, 0, 100),
    eyeContact: {
      facingForwardPct: num(ec.facingForwardPct, 0, 100),
      longestAwaySec: num(ec.longestAwaySec, 0, 100000),
      awaySpans: parseSpans(ec.awaySpans),
    },
    posture: {
      uprightPct: num(po.uprightPct, 0, 100),
      headTilt:
        tilt === "tilted left" || tilt === "tilted right" ? tilt : "level",
      shoulderLevelPct:
        typeof po.shoulderLevelPct === "number"
          ? num(po.shoulderLevelPct, 0, 100)
          : null,
      leanForwardSpans: parseSpans(po.leanForwardSpans),
      swayNote:
        typeof po.swayNote === "string" ? po.swayNote.slice(0, 120) : null,
      stillnessScore: num(po.stillnessScore, 0, 100, 100),
    },
    expressiveness: {
      smileCount: num(ex.smileCount, 0, 100000),
      smilePresentPct: num(ex.smilePresentPct, 0, 100),
      avgSmileIntensity: num(ex.avgSmileIntensity, 0, 1),
      browTensionPct: num(ex.browTensionPct, 0, 100),
      browTensionSpans: parseSpans(ex.browTensionSpans),
    },
  };
}

function clock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const spanList = (spans: NonverbalSpan[]) =>
  spans.length
    ? spans.map((s) => `${clock(s.startSec)}–${clock(s.endSec)}`).join(", ")
    : "none";

/** Human-readable block appended to the feedback prompt when webcam data exists. */
export function formatNonverbalForPrompt(m: NonverbalMetrics): string {
  return [
    "NONVERBAL SIGNALS — rough in-browser estimates from the user's webcam (MediaPipe). Treat as approximate, not precise measurement, and don't over-read small numbers.",
    `- Session ~${m.durationSec}s, ${m.samples} samples. Face visible ~${m.faceDetectedPct}% of the time; upper body visible ~${m.poseDetectedPct}%.`,
    `- Eye contact: appeared to face the camera ~${m.eyeContact.facingForwardPct}% of the session. Sustained look-aways (2s+): ${spanList(m.eyeContact.awaySpans)}${m.eyeContact.longestAwaySec ? ` (longest ~${m.eyeContact.longestAwaySec}s)` : ""}.`,
    `- Posture: head mostly ${m.posture.headTilt}; looked upright ~${m.posture.uprightPct}% of the time.` +
      (m.posture.shoulderLevelPct !== null
        ? ` Shoulders level ~${m.posture.shoulderLevelPct}% of the time.`
        : " Shoulders not reliably detected.") +
      (m.posture.leanForwardSpans.length
        ? ` Leaned toward the camera during: ${spanList(m.posture.leanForwardSpans)}.`
        : "") +
      (m.posture.swayNote ? ` Movement: ${m.posture.swayNote}.` : ""),
    `- Expressiveness: smiled ~${m.expressiveness.smileCount} time(s), present in ~${m.expressiveness.smilePresentPct}% of face frames (avg intensity ${m.expressiveness.avgSmileIntensity} of 1). Brow tension elevated ~${m.expressiveness.browTensionPct}% of face frames; notable during: ${spanList(m.expressiveness.browTensionSpans)}.`,
  ].join("\n");
}
