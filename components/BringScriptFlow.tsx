"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  TONES,
  TONE_LABELS,
  type StoredScript,
  type Tone,
} from "@/lib/types";
import { ACCEPTED_UPLOAD, extractScriptText } from "@/lib/scriptImport";
import {
  broadcastToneChange,
  loadState,
  requestScriptLabel,
  saveCurrentScript,
} from "@/lib/practiceStore";
import { reportClientError } from "@/lib/clientErrors";
import { EVENTS, track } from "@/lib/analytics";

// The "I already know what I want to say" path. If there's a script in
// localStorage already (generated on /generate, or brought here before), offer
// to use it as-is or replace it. Otherwise, just show a paste box.
type Mode = "loading" | "existing" | "compose";

export default function BringScriptFlow() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("loading");
  const [existing, setExisting] = useState<StoredScript | null>(null);

  const [script, setScript] = useState("");
  const [tone, setTone] = useState<Tone | "">("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const savedAtRef = useRef(0);
  const methodRef = useRef<"paste" | "upload">("paste");

  useEffect(() => {
    let cancelled = false;
    loadState()
      .then((state) => {
        if (cancelled) return;
        if (state.currentScript) {
          setExisting(state.currentScript);
          setMode("existing");
        } else {
          setMode("compose");
        }
      })
      .catch((err) => {
        reportClientError(err, { area: "script:hydrate" });
        if (!cancelled) setMode("compose");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = (text: string, t: Tone | "", label?: string): Promise<void> => {
    if (!savedAtRef.current) savedAtRef.current = Date.now();
    return saveCurrentScript({
      script: text,
      situation: "",
      tone: t,
      savedAt: savedAtRef.current,
      source: "uploaded",
      ...(label ? { label } : {}),
    });
  };

  // Persist composed drafts as they change (debounced), so leaving the page
  // doesn't lose them. Only kicks in once you're actually composing something.
  useEffect(() => {
    if (mode !== "compose" || !script.trim()) return;
    const id = setTimeout(() => {
      void persist(script.trim(), tone).catch((err) =>
        reportClientError(err, { area: "script:draft-sync" }),
      );
    }, 800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, script, tone]);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const { text, truncated } = await extractScriptText(file);
      methodRef.current = "upload";
      setScript(text);
      setNotice(
        `Imported “${file.name}”${
          truncated ? " — trimmed to the first 8,000 characters" : ""
        }.`,
      );
    } catch (err) {
      reportClientError(err, { area: "script-upload:client" });
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setUploading(false);
    }
  }

  function handleToneChange(next: Tone | "") {
    setTone(next);
    broadcastToneChange(next);
  }

  function startCompose() {
    // Don't wipe storage yet — the existing script survives until they type
    // something. Just reset this form and the rubric picker's live view.
    setExisting(null);
    setScript("");
    setTone("");
    setNotice(null);
    setError(null);
    savedAtRef.current = 0;
    methodRef.current = "paste";
    broadcastToneChange("");
    setMode("compose");
  }

  async function goPractice() {
    const trimmed = script.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      // Tiny Haiku call to title the script (no situation text on this path),
      // then save. Await both so /practice's hydration fetch sees them.
      const label = await requestScriptLabel("", trimmed);
      await persist(trimmed, tone, label);
    } catch (err) {
      reportClientError(err, { area: "script:go-practice" });
      setError("Couldn't save your script. Please try again.");
      setSaving(false);
      return;
    }
    // Event only — the script text is never sent.
    track(EVENTS.scriptProvided, {
      tone: tone || "none",
      method: methodRef.current,
    });
    router.push("/practice");
  }

  async function useExisting() {
    // Backfill a label/id for scripts saved before history grouping existed.
    if (existing && !existing.label) {
      setSaving(true);
      try {
        const label = await requestScriptLabel(
          existing.situation,
          existing.script,
        );
        await saveCurrentScript({ ...existing, label: label || undefined });
      } catch (err) {
        reportClientError(err, { area: "script:use-existing" });
      }
    }
    track(EVENTS.scriptProvided, {
      tone: existing?.tone || "none",
      method: "reused",
    });
    router.push("/practice");
  }

  if (mode === "loading") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading…
      </div>
    );
  }

  if (mode === "existing" && existing) {
    const kind =
      existing.source === "generated"
        ? "You generated this script earlier"
        : existing.source === "uploaded"
          ? "You saved this script earlier"
          : "Your current script";
    return (
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-medium text-slate-700">
            {kind}
            {existing.tone && (
              <span className="font-normal text-slate-400">
                {" "}
                · tuned for a {TONE_LABELS[existing.tone]} conversation
              </span>
            )}
          </p>
          <div className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
            {existing.script}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={useExisting}
            disabled={saving}
            className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Use this script →"}
          </button>
          <button
            type="button"
            onClick={startCompose}
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Write my own instead
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <label
          htmlFor="script"
          className="block text-sm font-medium text-slate-700"
        >
          What do you plan to say?
        </label>
        <textarea
          id="script"
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={10}
          maxLength={8000}
          placeholder="Paste your script or notes here…"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-relaxed shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400">or</span>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "Reading…" : "Upload a file"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_UPLOAD}
            onChange={handleFile}
            className="hidden"
          />
          <span className="text-xs text-slate-400">.txt, .md, or .pdf</span>
        </div>
      </div>

      <div>
        <label
          htmlFor="tone"
          className="block text-sm font-medium text-slate-700"
        >
          Tone / context <span className="text-slate-400">(optional)</span>
        </label>
        <select
          id="tone"
          value={tone}
          onChange={(e) => handleToneChange(e.target.value as Tone | "")}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">No preference</option>
          {TONES.map((t) => (
            <option key={t} value={t}>
              {TONE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {notice && !error && (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={goPractice}
        disabled={!script.trim() || saving}
        className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving…" : "Continue to practice →"}
      </button>
    </div>
  );
}
