import type {
  EffectiveResult,
  InterviewExchange,
  InterviewPanelist,
  InterviewPrepState,
  NonverbalMetrics,
  ObservableSignals,
  PresentationPrep,
  QAExchange,
  SlideTiming,
  Tone,
} from "./types";
import { formatNonverbalForPrompt } from "./nonverbal";
import { formatRubricForPrompt } from "./rubric";
import { formatDuration } from "./presentationPrep";

/**
 * Bump this whenever SYSTEM_PROMPT, FEEDBACK_SYSTEM_PROMPT, or the prompt
 * builders below change meaningfully. evals/run.ts stamps every result file
 * with it so quality runs stay comparable (or clearly not) across prompt
 * revisions — see evals/README.md.
 */
export const PROMPT_VERSION = "1.0.0";

export const SYSTEM_PROMPT = `You are a communication coach. You help people prepare for real, spoken conversations that feel high-stakes to them — difficult family talks, negotiations, pitches, feedback, apologies, and the like.

Given a situation, produce a short, practical script the person can rehearse out loud in two to three minutes.

Begin your response with a single line in exactly this form:
Title: <a 2-4 word label for this conversation, like a chat title — no quotes, no trailing punctuation>
Then a blank line, then the script.

Format the script in Markdown with exactly these sections:
- **Goal** — one sentence naming what a good outcome looks like.
- **Opening line** — a specific sentence they can say to start.
- **Key talking points** — 3 to 5 bullets, each a short thing to say in their own voice (not stage directions).
- **If it gets tense** — 2 bullets: a de-escalating phrase or a way to steer back on track.
- **Close** — one sentence to end on.

Write in plain, natural spoken language. No jargon, no filler, and no preamble before the script.`;

const TONE_GUIDANCE: Record<Tone, string> = {
  professional:
    "Keep it professional and measured — appropriate for colleagues or clients.",
  personal:
    "Keep it warm and personal — this is someone they care about, not a transaction.",
  "high-stakes":
    "Treat this as high-stakes: calm, clear, and deliberate, and acknowledge the weight of the moment.",
  supportive:
    "Lead with support and reassurance — the other person may be anxious or hurting.",
  persuasive:
    "Be persuasive: make a clear ask, lead with the other side's interests, and give concrete reasons.",
  celebratory:
    "Keep it upbeat and celebratory while staying sincere and specific.",
  defending:
    "Treat this as defending your work under expert questioning: stay composed and precise when pushed on a specific claim, and favor admitting uncertainty over guessing or overstating.",
};

export const LABEL_SYSTEM_PROMPT =
  "You write very short titles for saved conversation scripts, like chat titles. " +
  "Given a situation and/or a script, reply with ONLY a 2-4 word label — no quotes, " +
  "no trailing punctuation, no explanation. Examples: \"Boss — raise ask\", " +
  "\"Daughter curfew talk\", \"Investor pitch intro\".";

export function buildLabelPrompt(situation: string, script: string): string {
  const lines: string[] = [];
  if (situation.trim()) lines.push(`Situation: ${situation.trim()}`);
  if (script.trim()) {
    lines.push(`Script excerpt:\n${script.trim().slice(0, 600)}`);
  }
  lines.push("", "Label:");
  return lines.join("\n");
}

export function buildUserPrompt(situation: string, tone?: Tone): string {
  const lines = [`Situation: ${situation}`];
  if (tone) {
    lines.push(`Tone/context: ${tone}. ${TONE_GUIDANCE[tone]}`);
  }
  lines.push("", "Write the script.");
  return lines.join("\n");
}

export const FEEDBACK_SYSTEM_PROMPT = `You are a communication coach reviewing a rehearsal. The user was given a prepared script for a real spoken conversation, practiced it out loud, and their attempt was captured by speech-to-text — so expect some transcription noise and do not comment on it. Sometimes the user also turns on their webcam, in which case rough nonverbal signals (eye contact, posture, expressiveness) are included below.

Compare the attempt to the script and give focused, encouraging feedback the user can act on before their next take.

Format the response in Markdown with these sections, in this order:
- **Overall** — two sentences on how close the attempt is to being ready, in plain terms.
- **What landed** — 2 to 3 bullets naming specific things they did well. Quote short phrases from their attempt where it helps.
- **Gaps vs. the script** — 2 to 3 bullets: talking points they skipped, softened, or rushed past. Name the script section.
- **Delivery** — 2 to 3 bullets on hedging, filler, over-explaining, or wording that undercuts the message.
- **Nonverbal** — include this section ONLY if nonverbal webcam signals are provided below. 2 to 4 bullets on eye contact, posture, and expressiveness, grounded in the numbers given. Treat the numbers as rough estimates, not exact truth, and don't over-interpret small differences. If no nonverbal signals are provided, omit this section entirely.
- **For your next take** — 2 to 3 concrete, prioritized changes.

If an EFFECTIVENESS RUBRIC is provided below, it defines which qualities matter for this conversation and how much (either tuned to the tone/context or hand-picked by the user). Name the "Effective" score once in **Overall**, and let the rubric steer **For your next take** toward the highest-weighted quality that scored lowest. Do not add a separate rubric section and do not print the numbers as a table.

Be direct but supportive. No preamble before the feedback.`;

export interface FeedbackPromptExtras {
  nonverbal?: NonverbalMetrics | null;
  effective?: EffectiveResult | null;
  signals?: ObservableSignals | null;
  /** true when the rubric was hand-edited rather than the tone preset. */
  rubricCustom?: boolean;
}

export function buildFeedbackPrompt(
  script: string,
  transcript: string,
  situation?: string,
  tone?: Tone,
  extras: FeedbackPromptExtras = {},
): string {
  const lines = [
    `Situation: ${situation?.trim() || "(not provided)"}`,
  ];
  if (tone) {
    lines.push(`Tone/context: ${tone}. ${TONE_GUIDANCE[tone]}`);
  }
  lines.push(
    "",
    "--- PREPARED SCRIPT ---",
    script.trim(),
    "",
    "--- REHEARSAL TRANSCRIPT ---",
    transcript.trim(),
  );
  if (extras.nonverbal) {
    lines.push("", `--- ${formatNonverbalForPrompt(extras.nonverbal)}`);
  }
  if (extras.effective && extras.signals) {
    lines.push(
      "",
      `--- ${formatRubricForPrompt(extras.effective, extras.signals, {
        tone,
        custom: extras.rubricCustom,
      })}`,
    );
  }
  lines.push("", "Give the feedback.");
  return lines.join("\n");
}

/**
 * "Grill" mode (app/grill) — defend uploaded material under follow-up
 * questioning. Not covered by PROMPT_VERSION/evals above; these prompts aren't
 * exercised by evals/run.ts.
 */

export const QUESTION_SYSTEM_PROMPT = `You are helping someone rehearse defending a proposal, presentation, or piece of written work before an audience that will question it — reviewers, stakeholders, an expert panel.

Given the material in <source_material>, generate the questions a sharp, knowledgeable reviewer is likely to ask about it — ones that probe assumptions, missing evidence, edge cases, and claims stated more confidently than the material supports.

The person will answer each question out loud, on the spot, so every question must be a single, direct question:
- Ask exactly one thing. No compound questions — no "X, and what's the fallback if not?", no "— and how would you…" second half. If a topic has two angles, pick the sharper one.
- One sentence, ending in "?". Aim for under 25 words; never more than 35.
- Lead with the question itself, not a long restatement of the material. A short clause of context is fine ("The benchmark used 100M rows — how do you know it holds at 900M?").

Reply with ONLY a numbered list, one question per line, in exactly this form:
1. <question>
2. <question>
...
Generate between 3 and 6 questions. No preamble, no commentary, no headers — just the numbered list.`;

export function buildQuestionsPrompt(source: string): string {
  return [
    "<source_material>",
    source.trim(),
    "</source_material>",
    "",
    "Generate the questions.",
  ].join("\n");
}

export const FOLLOWUP_SYSTEM_PROMPT = `You are an expert reviewer following up on someone's spoken answer to a question about material they wrote or proposed.

You are given two different things, and keeping them apart is the most important part of this task:
- <source_material> is the written document. It is the ONLY record of what "the proposal", "the plan", "the doc", or "your write-up" says.
- <candidate_answer> is what the person just said out loud. Anything that appears only there is their spoken claim, made in the moment — it is NOT in the document, even though the same person wrote both.

Attribution rules:
- Only say the proposal/plan/document states, schedules, includes, or assumes something if it actually appears in <source_material>.
- Attribute anything that appears only in <candidate_answer> to the person speaking: "you said…", "you mentioned…", "you just claimed…". Never describe it as part of the plan.
- If you do press on a detail they added out loud, be accurate about where it came from ("you said X, but the proposal doesn't mention it…"). Don't claim something is missing from the document unless you've checked <source_material>.

Ask ONE natural follow-up that presses on the weakest or most consequential point in their answer. Good targets include: an unsupported claim, a number stated vaguely or that doesn't match the document, a detail the document contradicts, the part of the question they sidestepped, or a new detail they added that the rest of their answer depends on. Pick whichever matters most for this answer — don't default to "where does that come from?".

Do not ask a generic follow-up like "can you elaborate" or "tell me more" — name the specific thing you're pushing on. Do not repeat ground another question already covers.

They will answer out loud, so ask exactly one thing: a single sentence ending in "?", under 30 words, no compound second half.

Reply with ONLY the follow-up question — no quotes, no preamble, no explanation.`;

export function buildFollowUpPrompt(
  source: string,
  originalQuestion: string,
  transcript: string,
  otherQuestions?: string[],
): string {
  // XML tags with explicit closers rather than "--- X ---" headers: uploaded
  // material is often Markdown with its own "---" rules and headings, and the
  // model must never blur where the document ends and the spoken answer begins.
  const lines = [
    "<source_material>",
    source.trim(),
    "</source_material>",
    "",
    "<original_question>",
    originalQuestion.trim(),
    "</original_question>",
    "",
    "<candidate_answer>",
    "(Spoken out loud and transcribed by speech-to-text — expect some transcription noise. Not part of the source material.)",
    transcript.trim(),
    "</candidate_answer>",
  ];
  if (otherQuestions?.length) {
    lines.push(
      "",
      "<other_questions_already_asked>",
      otherQuestions.map((q) => `- ${q}`).join("\n"),
      "</other_questions_already_asked>",
    );
  }
  lines.push(
    "",
    "Ask the follow-up. Anything you attribute to the proposal must appear in <source_material>; anything only in <candidate_answer> is something they said.",
  );
  return lines.join("\n");
}

export const QA_FEEDBACK_SYSTEM_PROMPT = `You are a communication coach reviewing a rehearsal for defending written material (a proposal, a presentation, a pitch) under expert questioning. The user was asked a question about material they wrote or proposed, answered out loud, got one pointed follow-up based on their actual answer, and answered that too. Both answers were captured by speech-to-text — expect some transcription noise and do not comment on it.

Compare what they said to the source material and give focused, encouraging feedback they can act on before doing this again.

You are given two different things, and keeping them apart is the core of the "Accuracy vs. source" section:
- <source_material> is the written document. It is the ONLY record of what "the proposal", "the plan", or "the doc" says.
- Each <answer> inside an <exchange> is what the person said out loud, in the moment. Anything that appears only there is their spoken claim — it is NOT in the document, even though the same person wrote both.

Attribution rules:
- Only say a claim "matches the source" or is "in the proposal" if it actually appears in <source_material>.
- A specific detail they stated out loud that <source_material> doesn't contain (a number, a date, a name, a test they say was run, a step they say is planned) is an addition, not a match — call it out as such under Accuracy vs. source, even if it sounds plausible. Don't claim something is missing from the document unless you've checked <source_material>.
- Quote their words as theirs ("you said…"), and the document's as the document's.

Format the response in Markdown with these sections, in this order:
- **Overall** — two sentences on how they held up under the questioning, in plain terms.
- **Accuracy vs. source** — 2 to 3 bullets: claims that matched the source well, and any that overstated, invented, or contradicted it. Quote short phrases from their answers where it helps.
- **Composure** — 2 to 3 bullets on how they handled being pushed on the follow-up — did they concede uncertainty honestly, hedge, or double down on a shaky claim.
- **For next time** — 2 to 3 concrete, prioritized changes.

Be direct but supportive. No preamble before the feedback.`;

export function buildQAFeedbackPrompt(
  source: string,
  exchanges: QAExchange[],
): string {
  // Explicit open/close tags, same reasoning as buildFollowUpPrompt: the
  // feedback's "Accuracy vs. source" section is only as good as the model's
  // grip on where the document ends and the spoken answers begin.
  const lines = ["<source_material>", source.trim(), "</source_material>", ""];
  exchanges.forEach((ex, i) => {
    lines.push(
      `<exchange number="${i + 1}">`,
      "<question>",
      ex.question.trim(),
      "</question>",
      "<answer>",
      "(Spoken out loud and transcribed by speech-to-text. Not part of the source material.)",
      ex.transcript.trim(),
      "</answer>",
      "</exchange>",
      "",
    );
  });
  lines.push(
    "Give the feedback. Anything you describe as in the proposal must appear in <source_material>; anything only in an <answer> is something they said.",
  );
  return lines.join("\n");
}

// --- Interview prep (app/prep/interview) ------------------------------------

/** "P1".."Pn" for a panelist id (panel order), "P?" if not found. */
export function panelTag(panel: InterviewPanelist[], panelistId: string): string {
  const i = panel.findIndex((p) => p.id === panelistId);
  return i === -1 ? "P?" : `P${i + 1}`;
}

/** The shared panel + candidate context for all three interview prompts. XML
 *  tags with explicit closers, like the grill prompts: pasted LinkedIn text and
 *  resumes are full of their own headings and rules. Empty fields are omitted;
 *  an interviewer with nothing filled in still gets a tag so P-numbering stays
 *  aligned with the panel array. */
export function buildInterviewContext({ panel, candidate }: InterviewPrepState): string {
  const lines: string[] = ["<panel>"];
  panel.forEach((p, i) => {
    lines.push(`<interviewer tag="P${i + 1}">`);
    const before = lines.length;
    if (p.name.trim()) lines.push(`Name: ${p.name.trim()}`);
    if (p.title.trim()) lines.push(`Title: ${p.title.trim()}`);
    if (p.company.trim()) lines.push(`Company: ${p.company.trim()}`);
    if (p.about.trim()) {
      lines.push("<what_we_know>", p.about.trim(), "</what_we_know>");
    }
    if (p.pastQuestions.trim()) {
      lines.push(
        "<questions_they_have_asked_before>",
        p.pastQuestions.trim(),
        "</questions_they_have_asked_before>",
      );
    }
    if (lines.length === before) lines.push("(no details given)");
    lines.push("</interviewer>");
  });
  lines.push("</panel>");

  if (candidate.jobDescription.trim()) {
    lines.push("", "<job_description>", candidate.jobDescription.trim(), "</job_description>");
  }
  if (candidate.background.trim()) {
    lines.push("", "<candidate_background>", candidate.background.trim(), "</candidate_background>");
  }
  if (candidate.keyPoints.length) {
    lines.push(
      "",
      "<key_points_to_land>",
      candidate.keyPoints.map((k) => `- ${k}`).join("\n"),
      "</key_points_to_land>",
    );
  }
  return lines.join("\n");
}

export const INTERVIEW_PLAN_SYSTEM_PROMPT = `You are running a realistic mock job interview. You are given the interview panel (each interviewer tagged P1, P2, …, with whatever the candidate knows about them) and, optionally, the job description, the candidate's background, and points the candidate wants to land.

Plan the interview as 4 or 5 questions, in the order a real interview would ask them: a warm opener, then the substantive questions, then a closing question.

- Spread the questions across the panel. Each question is asked by one interviewer and must sound like that person: their role, their priorities, and anything the candidate knows about them should shape what they ask and how.
- If an interviewer has <questions_they_have_asked_before>, include at least one of those questions, verbatim or lightly adapted, asked by that interviewer.
- When a job description or candidate background is given, aim questions at them — name a specific project, skill, or gap where you can ("Walk me through the Acme migration — what did you own?").
- <key_points_to_land> are what the candidate hopes to work into their answers on their own — the practice is finding the opening. Never ask about a key point or name its subject (no "Tell me about the migration you led" when a key point is "I led the migration"). Instead, make sure at least one question is broad enough to leave room for it ("Tell me about a project you're proud of").

They will answer out loud, so each question asks exactly one thing: a single sentence ending in "?", under 30 words, no compound second half.

Reply with ONLY the plan, one question per line, in exactly this form:
P1: <question>
P2: <question>
...
No preamble, no numbering, no commentary.`;

export function buildInterviewPlanPrompt(prep: InterviewPrepState): string {
  return [buildInterviewContext(prep), "", "Plan the interview."].join("\n");
}

export const INTERVIEW_FOLLOWUP_SYSTEM_PROMPT = `You are one interviewer on a mock interview panel. You just asked the candidate a question and heard their spoken answer (captured by speech-to-text — ignore transcription noise). Decide whether a real interviewer in your seat would follow up.

Follow up when the answer left something concrete unresolved: a vague claim with no example, a result with no number or outcome, a decision with no reasoning, "we" where you need to know what they personally did, or the part of the question they sidestepped. Name the specific thing you're pressing on — never "can you elaborate" or "tell me more".

Don't follow up when the answer was complete and specific; move on instead. Don't ask anything the upcoming planned questions already cover.

Stay in character as the interviewer tagged in <asked_by>: their role and priorities shape what they'd press on.

If you follow up: ask exactly one thing — a single sentence ending in "?", under 30 words, no compound second half. Reply with ONLY the question, no quotes, no preamble.
If you don't: reply with exactly NONE.`;

export function buildInterviewFollowUpPrompt(
  prep: InterviewPrepState,
  panelistId: string,
  question: string,
  transcript: string,
  upcomingQuestions: string[],
): string {
  const lines = [
    buildInterviewContext(prep),
    "",
    `<asked_by tag="${panelTag(prep.panel, panelistId)}" />`,
    "<question>",
    question.trim(),
    "</question>",
    "",
    "<candidate_answer>",
    "(Spoken out loud and transcribed by speech-to-text — expect some transcription noise.)",
    transcript.trim(),
    "</candidate_answer>",
  ];
  if (upcomingQuestions.length) {
    lines.push(
      "",
      "<upcoming_questions>",
      upcomingQuestions.map((q) => `- ${q}`).join("\n"),
      "</upcoming_questions>",
    );
  }
  lines.push("", "Follow up, or reply NONE.");
  return lines.join("\n");
}

export const INTERVIEW_FEEDBACK_SYSTEM_PROMPT = `You are an interview coach reviewing a mock interview. The candidate answered each question out loud (captured by speech-to-text — ignore transcription noise and never comment on it). Some questions got one follow-up from the same interviewer.

You are given the panel (tagged P1, P2, …, with what the candidate knows about each person), optionally the job description, the candidate's background, and key points they wanted to land, then the exchanges.

Give focused, encouraging, specific feedback they can act on before the real interview. Quote short phrases from their answers where it helps. When their background contains a stronger or more relevant example than the one they used, name it.

Format the response in Markdown with these sections, in this order, using exactly these bold headings:
- **Overall** — two or three sentences on how the interview went.
- **Question by question** — for each exchange, a "### " subheading with the question (shortened if long), then 2 to 3 bullets: what worked, what was missing (a result, a number, their personal role, a direct answer), and how the follow-up went if there was one.
- **Key points** — ONLY if <key_points_to_land> is present: for each key point, whether it landed, where, or that it never came up. Omit this section entirely otherwise.
- **Reading the panel** — 2 to 3 bullets on how well the answers matched what each interviewer appears to care about, by name or title.
- **For your next round** — 2 to 3 concrete, prioritized changes.

Be direct but supportive. No preamble before the feedback.`;

export function buildInterviewFeedbackPrompt(
  prep: InterviewPrepState,
  exchanges: InterviewExchange[],
): string {
  const lines = [buildInterviewContext(prep), ""];
  exchanges.forEach((ex, i) => {
    lines.push(
      `<exchange number="${i + 1}" asked_by="${panelTag(prep.panel, ex.panelistId)}">`,
      "<question>",
      ex.question.trim(),
      "</question>",
      "<answer>",
      ex.transcript.trim(),
      "</answer>",
    );
    // A follow-up shown but never answered (ended early) is left out entirely.
    if (ex.followUp?.trim() && ex.followUpTranscript?.trim()) {
      lines.push(
        "<follow_up>",
        ex.followUp.trim(),
        "</follow_up>",
        "<follow_up_answer>",
        ex.followUpTranscript.trim(),
        "</follow_up_answer>",
      );
    }
    lines.push("</exchange>", "");
  });
  lines.push("Give the feedback.");
  return lines.join("\n");
}

// --- Presentation mode (app/prep/presentation) -------------------------------

export const PRESENTATION_FEEDBACK_SYSTEM_PROMPT = `You are a presentation coach reviewing one rehearsal run-through of a talk. The speaker had speaker notes or slides (given below) — NOT a word-for-word script — and delivered the whole talk out loud in one take. It was captured by speech-to-text; ignore transcription noise and never comment on it.

Judge two things: whether they got their material across (coverage, order, timing), and how they delivered it. Paraphrasing the notes is fine and expected — "covered" means the point landed, not that the wording matched.

Format the response in Markdown with these sections, in this order, using exactly these bold headings:
- **Overall** — two or three sentences on how the run went. State the Effective score if one is given.
- **Coverage** — if slides are given (tagged S1, S2, …): one bullet per slide, "S<n> <title> — covered | partly | missed: <one short reason>". If only notes are given: identify up to 8 main talking points from the notes and give one bullet each with the same verdicts. Quote a few words from the transcript where it helps.
- **Flow & timing** — 2 to 3 bullets: order and transitions, time per slide when timings are given (call out slides that ran long or got rushed), and total length against the time limit when one is given.
- **Delivery** — 2 to 3 bullets on pace, filler words, and energy; name the highest-weighted quality that scored lowest when a rubric is given.
- **Nonverbal** — ONLY if a <camera> block is present: 1 to 2 bullets. Omit this section entirely otherwise.
- **For your next run** — 2 to 3 concrete, prioritized changes.

When a rubric block refers to "For your next take", apply that to **For your next run**. If an <audience> is described, say what that audience will care about where it matters ("the CFO will want the cost figure before slide 5"). Be direct but supportive. No preamble before the feedback.`;

export function buildPresentationFeedbackPrompt(input: {
  prep: PresentationPrep;
  transcript: string;
  durationSec: number;
  slideTimings: SlideTiming[];
  nonverbal: NonverbalMetrics | null;
  effective: EffectiveResult | null;
  signals: ObservableSignals | null;
}): string {
  const { prep } = input;
  const titleAttr = prep.title.trim().replace(/"/g, "'");
  const lines: string[] = [`<talk title="${titleAttr}">`];
  if (prep.mode === "slides") {
    prep.slides.forEach((s, i) => {
      lines.push(`<slide tag="S${i + 1}">`, `Title: ${s.title.trim() || "(untitled)"}`);
      if (s.notes.trim()) lines.push("<notes>", s.notes.trim(), "</notes>");
      else lines.push("(no notes)");
      lines.push("</slide>");
    });
  } else {
    lines.push("<notes>", prep.notes.trim(), "</notes>");
  }
  lines.push("</talk>");

  if (prep.audience.trim()) lines.push("", "<audience>", prep.audience.trim(), "</audience>");
  if (prep.timeLimitMin) lines.push("", `<time_limit minutes="${prep.timeLimitMin}" />`);

  lines.push("", "<slide_timings_summary>", `Total: ${formatDuration(input.durationSec)}`, "</slide_timings_summary>");
  if (prep.mode === "slides" && input.slideTimings.length) {
    const byId = new Map(input.slideTimings.map((t) => [t.slideId, t.seconds]));
    const rows = prep.slides
      .map((s, i) =>
        byId.has(s.id)
          ? `S${i + 1} ${s.title.trim() || "(untitled)"}: ${formatDuration(byId.get(s.id) as number)}`
          : null,
      )
      .filter(Boolean);
    if (rows.length) lines.push("", "<slide_timings>", ...(rows as string[]), "</slide_timings>");
  }

  if (input.effective && input.signals) {
    lines.push("", formatRubricForPrompt(input.effective, input.signals));
  }
  if (input.nonverbal) {
    lines.push("", "<camera>", formatNonverbalForPrompt(input.nonverbal), "</camera>");
  }

  lines.push(
    "",
    "<transcript>",
    "(Spoken out loud and transcribed by speech-to-text — expect some transcription noise.)",
    input.transcript.trim(),
    "</transcript>",
    "",
    "Give the feedback.",
  );
  return lines.join("\n");
}
