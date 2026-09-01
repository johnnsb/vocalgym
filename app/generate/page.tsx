import type { Metadata } from "next";
import Link from "next/link";
import GenerateFlow from "@/components/GenerateFlow";
import RubricPicker from "@/components/RubricPicker";

export const metadata: Metadata = {
  title: "Write a script · VocalGym",
  description: "Describe your situation and get a script to rehearse.",
};

export default function GeneratePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="font-serif text-h2 text-text-primary">
            Help me find the words
          </h1>
          <p className="mt-2 max-w-prose text-body text-text-body">
            Describe the conversation and we&apos;ll draft a short script and
            talking points you can rehearse.
          </p>
        </div>
        <Link
          href="/"
          className="mt-1 whitespace-nowrap text-body-sm font-medium text-text-muted underline underline-offset-4 transition hover:text-text-primary"
        >
          ← Home
        </Link>
      </header>
      <div className="space-y-8">
        <GenerateFlow />
        <RubricPicker />
      </div>
    </main>
  );
}
