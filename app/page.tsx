import Link from "next/link";
import FeedbackWidget from "@/components/FeedbackWidget";
import { Card } from "@/components/ui";

const PATHS = [
  {
    href: "/script",
    kicker: "I know what I need to say",
    line: "I just want to practice and get it right.",
    cta: "Practice my words",
  },
  {
    href: "/generate",
    kicker: "I don't know what to say yet",
    line: "Help me find the words, then we'll practice.",
    cta: "Help me write it",
  },
  {
    href: "/experts",
    kicker: "I want expert guidance",
    line: "Work through it with a coach before I practice.",
    cta: "Explore experts",
  },
];

const STEPS = [
  {
    title: "Start with your words or ours",
    body: "Paste a script, upload one, or have us draft it from a sentence about your situation.",
  },
  {
    title: "Rehearse it out loud",
    body: "Record yourself — turn the camera on if you want a read on eye contact and posture too.",
  },
  {
    title: "Get coached",
    body: "Claude scores the take against what “effective” means for you and tells you what to fix next.",
  },
];

export default function Home() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:py-24">
        <h1 className="font-serif text-display text-text-primary sm:text-[52px] sm:leading-[60px]">
          Support for your difficult conversations
        </h1>
        <p className="mx-auto mt-5 max-w-prose text-body text-text-body">
          Rehearse the conversation before you have it — script it, say it out
          loud, and see how you&apos;re really coming across.
        </p>
      </section>

      <section className="mx-auto max-w-container px-4 pb-16 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {PATHS.map((p) => (
            <Card
              key={p.href}
              as={Link}
              href={p.href}
              interactive
              className="group flex flex-col no-underline"
            >
              <span className="text-label font-semibold text-text-primary">
                {p.kicker}
              </span>
              <span className="mt-1.5 flex-1 text-body-sm text-text-body">
                {p.line}
              </span>
              <span className="mt-4 inline-flex items-center gap-1 text-body-sm font-medium text-text-accent">
                {p.cta}
                <span className="transition-transform group-hover:translate-x-0.5">
                  &rarr;
                </span>
              </span>
            </Card>
          ))}
        </div>
      </section>

      <section
        id="how-it-works"
        className="border-y border-border-subtle bg-surface-sunken"
      >
        <div className="mx-auto max-w-container px-4 py-16 sm:px-8">
          <h2 className="font-serif text-h2 text-text-primary">How it works</h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="flex h-8 w-8 items-center justify-center rounded-pill bg-ember text-body-sm font-semibold text-[#FFF8EE]">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-h4 text-text-primary">{s.title}</h3>
                <p className="mt-1.5 text-body-sm leading-relaxed text-text-body">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
          <Link
            href="/how-it-works"
            className="mt-8 inline-block text-body-sm font-medium text-text-accent underline underline-offset-4 hover:text-text-primary"
          >
            Read the full walkthrough &rarr;
          </Link>
        </div>
      </section>

      <footer className="border-t border-border-subtle">
        <div className="mx-auto flex max-w-container flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 text-body-sm text-text-muted sm:px-8">
          <span>VocalGym — practice for the conversations that matter.</span>
          <Link href="/how-it-works" className="hover:text-text-body">
            How it works
          </Link>
          <Link href="/faq" className="hover:text-text-body">
            FAQ
          </Link>
        </div>
      </footer>

      <FeedbackWidget
        surveyKey="general_feedback_rating"
        surveyName="General feedback"
        question="How's VocalGym working for you?"
        variant="floating"
      />
    </>
  );
}
