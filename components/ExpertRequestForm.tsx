"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { reportClientError } from "@/lib/clientErrors";
import { EVENTS, track } from "@/lib/analytics";
import { Button, Callout, Card, Field, Input, Textarea } from "@/components/ui";

export default function ExpertRequestForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [situation, setSituation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/expert-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, situation }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Request failed (${res.status}).`);
      }
      // Event only — no name / email / situation text.
      track(EVENTS.expertRequestSubmitted);
      setDone(true);
    } catch (err) {
      reportClientError(err, { area: "expert-request:client" });
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card tone="accent" className="space-y-1">
        <h2 className="text-h4 text-text-primary">
          Thanks — we&apos;ll get back to you with a tailored script.
        </h2>
        <p className="text-body-sm text-text-body">
          We&apos;ll reach out at {email}.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-body-sm font-medium text-text-accent underline underline-offset-2"
        >
          Back home
        </Link>
      </Card>
    );
  }

  return (
    <Card as="form" onSubmit={handleSubmit} className="space-y-4">
      <Field
        label="What's the conversation, and what do you need help with?"
        htmlFor="er-situation"
      >
        <Textarea
          id="er-situation"
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
          rows={5}
          maxLength={4000}
          required
          placeholder="e.g. I'm negotiating my exit package and need help framing the ask without burning the bridge."
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="er-name">
          <Input
            id="er-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            required
          />
        </Field>
        <Field label="Email" htmlFor="er-email">
          <Input
            id="er-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={320}
            required
          />
        </Field>
      </div>

      {error && <Callout tone="critical">{error}</Callout>}

      <Button
        type="submit"
        disabled={
          submitting || !name.trim() || !email.trim() || !situation.trim()
        }
      >
        {submitting ? "Sending…" : "Send request"}
      </Button>
      <p className="text-caption text-text-muted">
        We&apos;ll only use your email to follow up about this request.
      </p>
    </Card>
  );
}
