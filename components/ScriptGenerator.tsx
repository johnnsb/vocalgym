"use client";

import { useState, type FormEvent } from "react";
import ScriptForm from "./ScriptForm";
import ScriptResult from "./ScriptResult";
import type { GenerateScriptResponse, Tone } from "@/lib/types";
import { saveCurrentScript } from "@/lib/practiceStore";

export default function ScriptGenerator() {
  const [situation, setSituation] = useState("");
  const [tone, setTone] = useState<Tone | "">("");
  const [script, setScript] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situation, tone }),
      });
      const data = (await res.json()) as GenerateScriptResponse & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status}).`);
      }
      setScript(data.script);
      saveCurrentScript({
        script: data.script,
        situation,
        tone,
        savedAt: Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setScript(null);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!situation.trim() || loading) return;
    generate();
  }

  return (
    <div className="space-y-8">
      <ScriptForm
        situation={situation}
        tone={tone}
        loading={loading}
        onSituationChange={setSituation}
        onToneChange={setTone}
        onSubmit={handleSubmit}
      />

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {script && !error && (
        <ScriptResult
          script={script}
          loading={loading}
          onRegenerate={generate}
        />
      )}
    </div>
  );
}
