import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ · VocalGym",
  description: "Common questions about privacy, accounts, and what VocalGym does.",
};

// Stub — a handful of real short answers, more to come.
const FAQS = [
  {
    q: "Do I need an account?",
    a: "No. There are no accounts yet. Your current script, rubric, and practice history are tied to an anonymous per-browser session — clear your cookies or switch browsers and you start fresh.",
  },
  {
    q: "Where is my data stored?",
    a: "Scripts, rubric settings, and past attempts are saved server-side (Postgres), scoped to that anonymous session. Recorded audio is only playable during the session and is never saved.",
  },
  {
    q: "What happens with my camera?",
    a: "If you turn it on, video frames are analysed in your browser (MediaPipe) and never leave your device. Only a small summary of derived signals — facing-forward %, posture, expressiveness — is sent for coaching.",
  },
  {
    q: "What does it cost?",
    a: "Nothing right now. It's a demo, with a shared cap on AI requests so a single link can't run up a bill.",
  },
  {
    q: "Which browsers work?",
    a: "Chrome, Edge, and Safari for the live speech-to-text. Elsewhere the transcript box still accepts typed input.",
  },
];

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="text-3xl font-bold tracking-tight">FAQ</h1>
        <Link
          href="/"
          className="text-sm font-medium text-slate-500 underline underline-offset-4 transition hover:text-slate-800"
        >
          &larr; Home
        </Link>
      </header>

      <p className="text-slate-600">
        Still a work in progress — here&apos;s what comes up most. New to
        VocalGym?{" "}
        <Link
          href="/how-it-works"
          className="font-medium underline underline-offset-2"
        >
          How it works
        </Link>
        .
      </p>

      <dl className="mt-8 divide-y divide-slate-100">
        {FAQS.map((item) => (
          <div key={item.q} className="py-5">
            <dt className="text-base font-semibold text-slate-900">{item.q}</dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-slate-600">
              {item.a}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
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
