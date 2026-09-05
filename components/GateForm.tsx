"use client";

import { useState, type FormEvent } from "react";
import { Button, Card, Field, Icon, Input } from "@/components/ui";

export default function GateForm({ next }: { next: string }) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Incorrect password.");
      }
      // Full navigation (not router.push) — simplest, most robust way to land
      // on `next` now that the browser holds the vg_gate cookie.
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPassword("");
      setSubmitting(false);
    }
  }

  return (
    <Card as="form" onSubmit={handleSubmit} className="w-full space-y-5 text-left">
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-full"
          style={{ background: "var(--surface-accent-tint)", color: "var(--ember-text)" }}
        >
          <Icon name="lock" size={20} />
        </span>
        <div className="space-y-1">
          <h1 className="font-serif text-h3 text-text-primary">VocalGym is under wraps</h1>
          <p className="max-w-prose text-body-sm text-text-body">
            Enter the password to continue.
          </p>
        </div>
      </div>

      <Field label="Password" htmlFor="gate-password" error={error}>
        <Input
          id="gate-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          invalid={Boolean(error)}
          autoFocus
          required
          autoComplete="current-password"
        />
      </Field>

      <Button type="submit" fullWidth disabled={submitting || !password}>
        {submitting ? "Checking…" : "Enter"}
      </Button>
    </Card>
  );
}
