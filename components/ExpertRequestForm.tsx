"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { reportClientError } from "@/lib/clientErrors";
import { EVENTS, track } from "@/lib/analytics";

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
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
        <h2 className="text-lg font-semibold text-emerald-900">
          Thanks — we&apos;ll get back to you with a tailored script.
        </h2>
        <p className="mt-1 text-sm text-emerald-800">
          We&apos;ll reach out at {email}.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-medium text-emerald-900 underline"
        >
          Back home
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <label
          htmlFor="er-situation"
          className="block text-sm font-medium text-slate-700"
        >
          What&apos;s the conversation, and what do you need help with?
        </label>
        <textarea
          id="er-situation"
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
          rows={5}
          maxLength={4000}
          required
          placeholder="e.g. I'm negotiating my exit package and need help framing the ask without burning the bridge."
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="er-name"
            className="block text-sm font-medium text-slate-700"
          >
            Your name
          </label>
          <input
            id="er-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
        <div>
          <label
            htmlFor="er-email"
            className="block text-sm font-medium text-slate-700"
          >
            Email
          </label>
          <input
            id="er-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={320}
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={
          submitting || !name.trim() || !email.trim() || !situation.trim()
        }
        className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Send request"}
      </button>
      <p className="text-xs text-slate-400">
        We&apos;ll only use your email to follow up about this request.
      </p>
    </form>
  );
}
