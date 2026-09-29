import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, Icon } from "@/components/ui";

export const metadata: Metadata = {
  title: "Interviews & presentations · VocalGym",
  description: "Practice from your notes: a mock interview panel, or a talk you're giving.",
};

export default function PrepHubPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="font-serif text-h2 text-text-primary">
            Practice from your notes
          </h1>
          <p className="mt-2 max-w-prose text-body text-text-body">
            No script needed. Bring what you know, and rehearse out loud.
          </p>
        </div>
        <Link
          href="/"
          className="mt-1 whitespace-nowrap text-body-sm font-medium text-text-muted underline underline-offset-4 transition hover:text-text-primary"
        >
          ← Home
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card as={Link} href="/prep/interview" interactive className="group flex flex-col no-underline">
          <span className="flex items-center gap-2 text-label font-semibold text-text-primary">
            <Icon name="message-square" size={16} />
            Interview
          </span>
          <span className="mt-1.5 flex-1 text-body-sm text-text-body">
            Practice with a mock panel built from what you know about your
            interviewers.
          </span>
          <span className="mt-4 inline-flex items-center gap-1 text-body-sm font-medium text-text-accent">
            Start
            <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
          </span>
        </Card>

        <Card tone="sunken" className="flex flex-col" aria-disabled="true">
          <span className="flex items-center gap-2 text-label font-semibold text-text-muted">
            <Icon name="presentation" size={16} />
            Presentation
          </span>
          <span className="mt-1.5 flex-1 text-body-sm text-text-muted">
            Rehearse a talk from your speaker notes or talking points.
          </span>
          <span className="mt-4">
            <Badge tone="outline">Coming soon</Badge>
          </span>
        </Card>
      </div>
    </main>
  );
}
