import Link from "next/link";
import FeedbackWidget from "@/components/FeedbackWidget";

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
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Support for your difficult conversations
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
          Rehearse the conversation before you have it — script it, say it out
          loud, and see how you&apos;re really coming across.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="grid gap-4 sm:grid-cols-3">
          {PATHS.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="group flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            >
              <span className="text-sm font-semibold text-slate-900">
                {p.kicker}
              </span>
              <span className="mt-1 flex-1 text-sm text-slate-600">
                {p.line}
              </span>
              <span className="mt-4 text-sm font-medium text-slate-900">
                {p.cta}{" "}
                <span className="inline-block transition group-hover:translate-x-0.5">
                  &rarr;
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-3 text-sm font-semibold text-slate-900">
                  {s.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
          <Link
            href="/how-it-works"
            className="mt-6 inline-block text-sm font-medium text-slate-900 underline underline-offset-4 hover:text-slate-600"
          >
            Read the full walkthrough &rarr;
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 text-sm text-slate-400">
          <span>VocalGym — practice for the conversations that matter.</span>
          <Link href="/how-it-works" className="hover:text-slate-600">
            How it works
          </Link>
          <Link href="/faq" className="hover:text-slate-600">
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
