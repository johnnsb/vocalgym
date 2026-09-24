// Quality-eval test dataset: realistic situations spanning every tone preset
// in lib/rubric.ts (TONE_RUBRIC_PRESETS). This drives evals/run.ts — NOT the
// app's unit tests. Keep entries realistic and varied; add new ones here
// rather than inline in the runner.

import type { Tone } from "../lib/types";

export interface EvalCase {
  /** Stable short id — used in result filenames/keys, so keep it slug-safe. */
  id: string;
  situation: string;
  tone: Tone;
  /** Optional note on what makes this case worth having (shown in results). */
  notes?: string;
}

export const DATASET: EvalCase[] = [
  {
    id: "raise-ask",
    situation:
      "I want to ask my manager for a raise. I've taken on two extra projects this year and haven't had a comp review in 18 months.",
    tone: "professional",
    notes: "classic ask-with-evidence case",
  },
  {
    id: "deadline-pushback",
    situation:
      "My manager wants a client deliverable finished in one week, but the scope realistically needs three. I need to push back without sounding like I'm making excuses.",
    tone: "professional",
  },
  {
    id: "daughter-curfew",
    situation:
      "My 16-year-old daughter has been sneaking out past curfew and lying about where she's been. I need to have a serious talk with her without shutting her down completely.",
    tone: "personal",
    notes: "emotionally loaded parent/teen case",
  },
  {
    id: "roommate-guest",
    situation:
      "My roommate's partner has basically been living in our apartment for six weeks without asking, and it's affecting my rent-splitting and privacy. I need to bring it up.",
    tone: "personal",
  },
  {
    id: "layoff-notice",
    situation:
      "As a manager, I have to tell someone on my team tomorrow that their position is being eliminated in a company-wide layoff. They're a strong performer and it isn't their fault.",
    tone: "high-stakes",
    notes: "high emotional stakes, needs composure",
  },
  {
    id: "missed-deadline-client",
    situation:
      "I have to tell a major client that we missed a critical launch deadline due to an internal error, and walk them through the recovery plan without losing their trust.",
    tone: "high-stakes",
  },
  {
    id: "burnout-checkin",
    situation:
      "A coworker on my team seems burnt out — missed deadlines, short temper, looks exhausted in meetings. I want to check in without making them feel called out.",
    tone: "supportive",
  },
  {
    id: "friend-miscarriage",
    situation:
      "A close friend recently had a miscarriage and I haven't spoken with her since. I want to reach out and say something meaningful without being clumsy or minimizing it.",
    tone: "supportive",
    notes: "high sensitivity, easy to sound generic",
  },
  {
    id: "tool-adoption-pitch",
    situation:
      "I want to convince my team to switch from our current project-tracking tool to a new one I've been piloting, even though switching costs will annoy some people short-term.",
    tone: "persuasive",
  },
  {
    id: "rent-negotiation",
    situation:
      "My landlord is raising my rent 15% at renewal. I want to negotiate it down by pointing out I've been a reliable tenant for three years and comparable units rent for less.",
    tone: "persuasive",
  },
  {
    id: "wedding-toast",
    situation:
      "I'm giving the best man toast at my brother's wedding tonight and want it to be funny, heartfelt, and not run too long.",
    tone: "celebratory",
  },
  {
    id: "promotion-congrats",
    situation:
      "A direct report just got promoted to team lead after years of being passed over. I want to congratulate her in our 1:1 in a way that feels genuine and specific, not generic.",
    tone: "celebratory",
  },
  {
    id: "investor-pitch-open",
    situation:
      "I'm opening a 10-minute pitch to a skeptical investor who passed on our seed round last year, and I need the first 60 seconds to re-earn their attention.",
    tone: "persuasive",
    notes: "high-pressure persuasive case, distinct from tool/rent asks",
  },
  {
    id: "architecture-review-defense",
    situation:
      "I'm presenting a proposal to migrate our service to a new database at an architecture review, and a senior engineer is going to press me hard on latency numbers and edge cases I haven't fully tested yet.",
    tone: "defending",
    notes:
      "defending-under-Q&A case — should reward conceding untested claims over guessing at numbers",
  },
];
