import type { Metadata } from "next";
import Link from "next/link";
import PracticeSession from "@/components/PracticeSession";

export const metadata: Metadata = {
  title: "Practice · VocalGym",
  description: "Rehearse your script out loud and get coaching notes.",
};

export default function PracticePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <header className="mb-10 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Practice</h1>
          <p className="mt-2 max-w-xl text-slate-600">
            Rehearse your script out loud, then get specific notes on what landed
            and what to tighten before the real thing.
          </p>
        </div>
        <Link
          href="/"
          className="mt-1 whitespace-nowrap text-sm font-medium text-slate-500 underline underline-offset-4 transition hover:text-slate-800"
        >
          ← Home
        </Link>
      </header>
      <PracticeSession />
    </main>
  );
}
