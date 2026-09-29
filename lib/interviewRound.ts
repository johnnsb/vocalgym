import type { InterviewExchange, PlannedQuestion } from "./types";

// Pure round/persistence decisions for InterviewSession, pulled out so the
// parts most likely to lose user data are unit-tested.

/** Fold an answer into the exchanges: onto the pending follow-up of the last
 *  exchange, or as a new exchange for the planned question. A blank answer
 *  returns `exchanges` unchanged (e.g. "End early" with nothing recorded). */
export function recordAnswer(
  exchanges: InterviewExchange[],
  onFollowUp: boolean,
  planned: PlannedQuestion,
  answer: string,
): InterviewExchange[] {
  const text = answer.trim();
  if (!text) return exchanges;
  if (onFollowUp) {
    return exchanges.map((e, i) =>
      i === exchanges.length - 1 ? { ...e, followUpTranscript: text } : e,
    );
  }
  return [
    ...exchanges,
    { panelistId: planned.panelistId, question: planned.question, transcript: text },
  ];
}

/** Whether to PUT the setup. Only after the saved panel has loaded
 *  successfully: before that (or after a failed load) the form holds a blank
 *  panel, and saving it would overwrite the user's real saved one. */
export function shouldPersist(opts: {
  loaded: boolean;
  snapshot: string;
  lastSaved: string;
}): boolean {
  return opts.loaded && opts.snapshot !== opts.lastSaved;
}
