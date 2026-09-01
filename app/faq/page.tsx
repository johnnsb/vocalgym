import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui";

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
    <main className="mx-auto max-w-narrow px-4 py-16">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="font-serif text-h2 text-text-primary">FAQ</h1>
        <Link
          href="/"
          className="text-body-sm font-medium text-text-muted underline underline-offset-4 transition hover:text-text-primary"
        >
          &larr; Home
        </Link>
      </header>

      <p className="max-w-prose text-body text-text-body">
        Still a work in progress — here&apos;s what comes up most. New to
        VocalGym?{" "}
        <Link
          href="/how-it-works"
          className="font-medium text-text-accent underline underline-offset-2"
        >
          How it works
        </Link>
        .
      </p>

      <dl className="mt-8 divide-y divide-border-subtle">
        {FAQS.map((item) => (
          <div key={item.q} className="py-5">
            <dt className="text-h4 text-text-primary">{item.q}</dt>
            <dd className="mt-1.5 max-w-prose text-body-sm leading-relaxed text-text-body">
              {item.a}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex flex-wrap gap-3">
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
