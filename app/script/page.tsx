import type { Metadata } from "next";
import Link from "next/link";
import BringScriptFlow from "@/components/BringScriptFlow";
import RubricPicker from "@/components/RubricPicker";

export const metadata: Metadata = {
  title: "Your script · VocalGym",
  description: "Bring the words you plan to say and rehearse them.",
};

export default function ScriptPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Bring your own words
          </h1>
          <p className="mt-2 max-w-xl text-slate-600">
            Paste what you plan to say, or upload it as a file. Set the tone and
            what &ldquo;effective&rdquo; means, then go practice.
          </p>
        </div>
        <Link
          href="/"
          className="mt-1 whitespace-nowrap text-sm font-medium text-slate-500 underline underline-offset-4 transition hover:text-slate-800"
        >
          ← Home
        </Link>
      </header>
      <div className="space-y-8">
        <BringScriptFlow />
        <RubricPicker />
      </div>
    </main>
  );
}
