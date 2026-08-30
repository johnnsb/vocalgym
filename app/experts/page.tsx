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
          <h1 className="text-3xl font-bold tracking-tight">Get expert help</h1>
          <p className="mt-2 max-w-xl text-slate-600">
            Tell us about the conversation and what you&apos;re stuck on. A coach
            will follow up by email with a tailored script you can then rehearse
            here.
          </p>
        </div>
        <Link
          href="/"
          className="mt-1 whitespace-nowrap text-sm font-medium text-slate-500 underline underline-offset-4 transition hover:text-slate-800"
        >
          ← Home
        </Link>
      </header>

      <ExpertRequestForm />

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-slate-700">
          Common situations we help with
        </h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-500">
          {COMMON.map((c) => (
            <li key={c}>· {c}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
