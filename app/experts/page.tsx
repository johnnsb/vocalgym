import type { Metadata } from "next";
import Link from "next/link";
import ExpertRequestForm from "@/components/ExpertRequestForm";

export const metadata: Metadata = {
  title: "Expert help · VocalGym",
  description:
    "Tell us about your conversation and a coach will follow up with a tailored script.",
};

const COMMON = [
  "Feedback, negotiations, and tough calls at work",
  "Investor pitches, board updates, co-founder conflict",
  "Grades, boundaries, and hard talks with your kids",
  "Co-parenting decisions and repair in a marriage",
];

export default function ExpertsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="font-serif text-h2 text-text-primary">Get expert help</h1>
          <p className="mt-2 max-w-prose text-body text-text-body">
            Tell us about the conversation and what you&apos;re stuck on. A coach
            will follow up by email with a tailored script you can then rehearse
            here.
          </p>
        </div>
        <Link
          href="/"
          className="mt-1 whitespace-nowrap text-body-sm font-medium text-text-muted underline underline-offset-4 transition hover:text-text-primary"
        >
          ← Home
        </Link>
      </header>

      <ExpertRequestForm />

      <section className="mt-8">
        <h2 className="text-eyebrow uppercase text-text-muted">
          Common situations we help with
        </h2>
        <ul className="mt-3 space-y-1 text-body-sm text-text-muted">
          {COMMON.map((c) => (
            <li key={c}>· {c}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
