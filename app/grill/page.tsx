import type { Metadata } from "next";
import Link from "next/link";
import GrillSession from "@/components/GrillSession";

export const metadata: Metadata = {
  title: "Grill · VocalGym",
  description:
    "Upload what you're presenting and rehearse defending it under follow-up questioning.",
};

export default function GrillPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="font-serif text-h2 text-text-primary">
            Defend your work
          </h1>
          <p className="mt-2 max-w-prose text-body text-text-body">
            Upload what you&apos;re presenting, answer a likely question out
            loud, then handle one pointed follow-up based on what you actually
            said.
          </p>
        </div>
        <Link
          href="/"
          className="mt-1 whitespace-nowrap text-body-sm font-medium text-text-muted underline underline-offset-4 transition hover:text-text-primary"
        >
          ← Home
        </Link>
      </header>
      <GrillSession />
    </main>
  );
}
