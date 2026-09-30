import type { Metadata } from "next";
import Link from "next/link";
import PresentationSession from "@/components/PresentationSession";

export const metadata: Metadata = {
  title: "Presentation practice · VocalGym",
  description: "Rehearse a talk from your notes or slides and see what you covered.",
};

export default function PresentationPrepPage() {
  return (
    <main className="mx-auto max-w-container px-4 py-12 sm:px-8 sm:py-16">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="font-serif text-h2 text-text-primary">Rehearse your talk</h1>
          <p className="mt-2 max-w-prose text-body text-text-body">
            Bring your speaker notes or slides, run the whole talk out loud, and
            see which points landed — plus how you delivered them.
          </p>
        </div>
        <Link
          href="/prep"
          className="mt-1 whitespace-nowrap text-body-sm font-medium text-text-muted underline underline-offset-4 transition hover:text-text-primary"
        >
          ← Back
        </Link>
      </header>
      <PresentationSession />
    </main>
  );
}
