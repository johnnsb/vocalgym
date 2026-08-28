import type { Metadata } from "next";
import PracticeSession from "@/components/PracticeSession";

export const metadata: Metadata = {
  title: "Practice · VocalGym",
  description: "Rehearse your script out loud and get coaching notes.",
};

export default function PracticePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Practice</h1>
        <p className="mt-2 text-slate-600">
          Rehearse your script out loud, then get specific notes on what landed
          and what to tighten before the real thing.
        </p>
      </header>
      <PracticeSession />
    </main>
  );
}
