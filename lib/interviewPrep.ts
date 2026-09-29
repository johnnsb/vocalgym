import type {
  InterviewCandidate,
  InterviewExchange,
  InterviewPanelist,
  InterviewPrepState,
} from "./types";

// Pure normalization for interview prep (app/prep/interview). Used by the
// server before storing / prompting, and by the client when hydrating. No
// Prisma/React here so it's unit-testable and safe on both sides.

export const PREP_LIMITS = {
  panelMax: 4,
  short: 120, // name / title / company
  about: 8000,
  pastQuestions: 2000,
  jobDescription: 8000,
  background: 8000,
  keyPointsMax: 5,
  keyPoint: 200,
  id: 100,
  exchangesMax: 10,
  question: 500,
  transcript: 12000,
} as const;

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function obj(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

export function emptyPanelist(id: string): InterviewPanelist {
  return { id, name: "", title: "", company: "", about: "", pastQuestions: "" };
}

export function emptyPrep(): InterviewPrepState {
  return {
    panel: [emptyPanelist("p1")],
    candidate: { jobDescription: "", background: "", keyPoints: [] },
  };
}

function normalizeCandidate(v: unknown): InterviewCandidate {
  const c = obj(v);
  const keyPoints = Array.isArray(c.keyPoints)
    ? c.keyPoints
        .filter((k): k is string => typeof k === "string")
        .map((k) => k.trim().slice(0, PREP_LIMITS.keyPoint))
        .filter(Boolean)
        .slice(0, PREP_LIMITS.keyPointsMax)
    : [];
  return {
    jobDescription: str(c.jobDescription, PREP_LIMITS.jobDescription),
    background: str(c.background, PREP_LIMITS.background),
    keyPoints,
  };
}

/** Validate/truncate an untrusted prep blob. Never throws. Always returns 1–4
 *  panelists with unique, non-empty ids. */
export function normalizePrep(input: unknown): InterviewPrepState {
  const raw = obj(input);
  const rawPanel = Array.isArray(raw.panel)
    ? raw.panel.slice(0, PREP_LIMITS.panelMax)
    : [];

  const seen = new Set<string>();
  const panel = rawPanel.map((v, i): InterviewPanelist => {
    const p = obj(v);
    const base = str(p.id, PREP_LIMITS.id).trim() || `p${i + 1}`;
    let id = base;
    for (let n = i + 1; seen.has(id); n++) id = `${base}-${n}`;
    seen.add(id);
    return {
      id,
      name: str(p.name, PREP_LIMITS.short),
      title: str(p.title, PREP_LIMITS.short),
      company: str(p.company, PREP_LIMITS.short),
      about: str(p.about, PREP_LIMITS.about),
      pastQuestions: str(p.pastQuestions, PREP_LIMITS.pastQuestions),
    };
  });

  return {
    panel: panel.length ? panel : emptyPrep().panel,
    candidate: normalizeCandidate(raw.candidate),
  };
}

export function panelistHasContent(p: InterviewPanelist): boolean {
  return [p.name, p.title, p.company, p.about, p.pastQuestions].some(
    (f) => f.trim().length > 0,
  );
}

/** The key-point boxes to render: the saved list (blanks kept in place, so
 *  clearing a middle point doesn't shift the boxes under the cursor) plus one
 *  trailing empty box when the last one has text, up to the max. Blanks are
 *  dropped server-side by normalizePrep. */
export function keyPointInputs(keyPoints: string[]): string[] {
  const list = keyPoints.slice(0, PREP_LIMITS.keyPointsMax);
  const last = list[list.length - 1];
  const needsBlank =
    list.length < PREP_LIMITS.keyPointsMax && (last === undefined || last.trim() !== "");
  return needsBlank ? [...list, ""] : list;
}

/** At least one interviewer has something filled in — the "Start" gate. */
export function hasPanelContent(state: InterviewPrepState): boolean {
  return state.panel.some(panelistHasContent);
}

/** "Priya Shah · VP Engineering", falling back to "Interviewer N" (1-based). */
export function panelistLabel(p: InterviewPanelist, index: number): string {
  const who = p.name.trim() || `Interviewer ${index + 1}`;
  const title = p.title.trim();
  return title ? `${who} · ${title}` : who;
}

/** Validate untrusted exchanges for the feedback call. Drops unanswered
 *  exchanges, and drops a follow-up that was shown but never answered (the
 *  user ended early) so Claude never critiques a non-answer. */
export function normalizeExchanges(input: unknown): InterviewExchange[] {
  if (!Array.isArray(input)) return [];
  const out: InterviewExchange[] = [];
  for (const v of input) {
    if (out.length >= PREP_LIMITS.exchangesMax) break;
    const e = obj(v);
    if (typeof e.panelistId !== "string" || typeof e.question !== "string") continue;
    const question = e.question.trim().slice(0, PREP_LIMITS.question);
    const transcript = str(e.transcript, PREP_LIMITS.transcript).trim();
    if (!question || !transcript) continue;
    const ex: InterviewExchange = {
      panelistId: e.panelistId.slice(0, PREP_LIMITS.id),
      question,
      transcript,
    };
    const followUp = str(e.followUp, PREP_LIMITS.question).trim();
    const followUpTranscript = str(e.followUpTranscript, PREP_LIMITS.transcript).trim();
    if (followUp && followUpTranscript) {
      ex.followUp = followUp;
      ex.followUpTranscript = followUpTranscript;
    }
    out.push(ex);
  }
  return out;
}
