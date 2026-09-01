import type { Metadata } from "next";
import Link from "next/link";
import { Button, Callout } from "@/components/ui";

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
    <main className="mx-auto max-w-narrow px-4 py-16">
      <header className="mb-10 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="font-serif text-h2 text-text-primary">How it works</h1>
        <Link
          href="/"
          className="text-body-sm font-medium text-text-muted underline underline-offset-4 transition hover:text-text-primary"
        >
          &larr; Home
        </Link>
      </header>

      <p className="max-w-prose text-body text-text-body">
        VocalGym is a rehearsal loop for the conversations that feel high-stakes.
        Three steps:
      </p>

      <ol className="mt-8 space-y-8">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-pill bg-ember text-body-sm font-semibold text-[#FFF8EE]">
              {i + 1}
            </span>
            <div>
              <h2 className="text-h4 text-text-primary">{s.title}</h2>
              <p className="mt-1 max-w-prose text-body-sm leading-relaxed text-text-body">
                {s.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <Callout tone="info" className="mt-12">
        More detail on the Effective score, the tone presets, and what the camera
        does (and doesn&apos;t) send is on the way. Questions in the meantime?{" "}
        <Link
          href="/faq"
          className="font-medium text-text-accent underline underline-offset-2"
        >
          See the FAQ
        </Link>
        .
      </Callout>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button as={Link} href="/generate" variant="primary">
          Write a script
        </Button>
        <Button as={Link} href="/script" variant="secondary">
          Bring your own
        </Button>
      </div>
    </main>
  );
}
