import type { Metadata } from "next";
import Link from "next/link";
import InterviewSession from "@/components/InterviewSession";

export const metadata: Metadata = {
  title: "Interview practice · VocalGym",
  description:
    "Describe who's interviewing you, then rehearse a mock interview out loud and get feedback.",
};

export default function InterviewPrepPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="font-serif text-h2 text-text-primary">Mock interview</h1>
          <p className="mt-2 max-w-prose text-body text-text-body">
            Tell us who you&apos;re meeting. We&apos;ll run a short interview in
            their voice: answer out loud, handle follow-ups, and see how it
            landed.
          </p>
        </div>
        <Link
          href="/prep"
          className="mt-1 whitespace-nowrap text-body-sm font-medium text-text-muted underline underline-offset-4 transition hover:text-text-primary"
        >
          ← Back
        </Link>
      </header>
      <InterviewSession />
    </main>
  );
}
