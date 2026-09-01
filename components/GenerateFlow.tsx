"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import ScriptForm from "./ScriptForm";
import ScriptResult from "./ScriptResult";
import FeedbackWidget from "./FeedbackWidget";
import type { GenerateScriptResponse, Tone } from "@/lib/types";
import {
  broadcastToneChange,
  loadState,
  saveCurrentScript,
} from "@/lib/practiceStore";
import { reportClientError } from "@/lib/clientErrors";
import { EVENTS, track } from "@/lib/analytics";
import { Callout } from "@/components/ui";

// The "help me find the words" path: describe the situation, Claude drafts a
// script. (The "bring your own words" path lives in BringScriptFlow.)
export default function GenerateFlow() {
  const [hydrated, setHydrated] = useState(false);
  const [situation, setSituation] = useState("");
  const [tone, setTone] = useState<Tone | "">("");
  const [script, setScript] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoLimited, setDemoLimited] = useState(false);
  const savedAtRef = useRef(0);
  const labelRef = useRef("");

  // Restore a previously generated draft so leaving for /practice and coming
  // back doesn't wipe the page. Ignore drafts the user brought themselves.
  useEffect(() => {
    let cancelled = false;
    loadState()
      .then((state) => {
        if (cancelled) return;
        const stored = state.currentScript;
        if (stored && stored.source !== "uploaded") {
          setSituation(stored.situation);
          setTone(stored.tone);
          setScript(stored.script);
          savedAtRef.current = stored.savedAt;
          labelRef.current = stored.label ?? "";
        }
      })
      .catch((err) => reportClientError(err, { area: "generate:hydrate" }))
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced draft sync — leaving the page mid-edit shouldn't lose the draft,
  // but we don't want a network write per keystroke.
  useEffect(() => {
    if (!hydrated || !script) return;
    const id = setTimeout(() => {
      void saveCurrentScript({
        script,
        situation,
        tone,
        savedAt: savedAtRef.current,
        source: "generated",
        label: labelRef.current || undefined,
      }).catch((err) =>
        reportClientError(err, { area: "generate:draft-sync" }),
      );
    }, 800);
    return () => clearTimeout(id);
  }, [hydrated, script, situation, tone]);

  async function generate() {
    setLoading(true);
    setError(null);
    setDemoLimited(false);
    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situation, tone }),
      });
      const data = (await res.json()) as GenerateScriptResponse & {
        error?: string;
        code?: string;
      };
      if (res.status === 429 && data.code === "demo_limit_reached") {
        setDemoLimited(true);
        setScript(null);
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status}).`);
      }
      savedAtRef.current = Date.now();
      labelRef.current = data.label || "";
      // Event only — the script text itself is never sent.
      track(EVENTS.scriptGenerated, { tone: tone || "none" });
      // Persist before showing the result so "Practice this script" always
      // finds it server-side.
      await saveCurrentScript({
        script: data.script,
        situation,
        tone,
        savedAt: savedAtRef.current,
        source: "generated",
        label: data.label || undefined,
      });
      setScript(data.script);
    } catch (err) {
      reportClientError(err, { area: "generate-script:client" });
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

  function handleToneChange(next: Tone | "") {
    setTone(next);
    broadcastToneChange(next);
  }

  return (
    <div className="space-y-8">
      <ScriptForm
        situation={situation}
        tone={tone}
        loading={loading}
        onSituationChange={setSituation}
        onToneChange={handleToneChange}
        onSubmit={handleSubmit}
      />

      {demoLimited && (
        <Callout tone="caution">
          This demo has hit its usage limit for now. Thanks for trying VocalGym —
          please check back later.
        </Callout>
      )}

      {error && !demoLimited && <Callout tone="critical">{error}</Callout>}

      {script && !error && (
        <>
          <ScriptResult
            script={script}
            loading={loading}
            onRegenerate={generate}
          />
          <FeedbackWidget
            surveyKey="script_generated_rating"
            surveyName="Generated script rating"
            question="How was this script?"
            variant="inline"
          />
        </>
      )}
    </div>
  );
}
