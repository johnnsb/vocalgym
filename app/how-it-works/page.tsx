import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it works · VocalGym",
  description: "Script it, say it out loud, get coached — the three-step loop.",
};

const STEPS = [
  {
    title: "Start with your words or ours",
    body: "Bring a script (paste it, or upload a .txt / .md / .pdf), or describe your situation in a sentence and have Claude draft one. Pick a tone so the coaching knows what “effective” means here.",
  },
  {
    title: "Rehearse it out loud",
    body: "Record yourself running the script. Speech-to-text captures what you actually said. Optionally turn on your camera for a rough read on eye contact, posture and expressiveness — analysed on your device, never uploaded.",
  },
  {
    title: "Get coached",
    body: "Claude compares your take to the script and scores it against the qualities you chose, rolled into one Effective score. You get specific notes on what landed, what you skipped, and the one thing to fix next.",
  },
];

// Stub — expands the inline overview on the landing page. More detail (privacy,
// the scoring rubric, nonverbal signals) to come.
export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <header className="mb-10 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="text-3xl font-bold tracking-tight">How it works</h1>
        <Link
          href="/"
          className="text-sm font-medium text-slate-500 underline underline-offset-4 transition hover:text-slate-800"
        >
          &larr; Home
        </Link>
      </header>

      <p className="text-slate-600">
        VocalGym is a rehearsal loop for the conversations that feel high-stakes.
        Three steps:
      </p>

      <ol className="mt-8 space-y-8">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
              {i + 1}
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {s.title}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {s.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-12 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        More detail on the Effective score, the tone presets, and what the camera
        does (and doesn&apos;t) send is on the way. Questions in the meantime?{" "}
        <Link href="/faq" className="font-medium underline underline-offset-2">
          See the FAQ
        </Link>
        .
      </div>

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link
          href="/generate"
          className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-700"
        >
          Write a script
        </Link>
        <Link
          href="/script"
          className="rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Bring your own
        </Link>
      </div>
    </main>
  );
}
