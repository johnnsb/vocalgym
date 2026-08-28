"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechAlternativeLike {
  transcript: string;
}
interface SpeechResultLike {
  isFinal: boolean;
  0: SpeechAlternativeLike;
  length: number;
}
interface SpeechResultListLike {
  length: number;
  [index: number]: SpeechResultLike;
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechResultListLike;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

export function speechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

type Status = "idle" | "recording" | "recorded";

interface Props {
  disabled?: boolean;
  /** Fires each time a recording stops, with whatever was captured. */
  onComplete: (result: { transcript: string; audioUrl: string | null }) => void;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PracticeRecorder({ disabled, onComplete }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const cleanupTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanupTimer();
      stopTracks();
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, [cleanupTimer, stopTracks]);

  const start = useCallback(async () => {
    setError(null);
    setInterim("");
    setElapsed(0);
    finalTranscriptRef.current = "";
    chunksRef.current = [];

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
      setAudioUrl(null);
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(
        "Couldn't access the microphone. Check the browser permission, or type your attempt below instead.",
      );
      return;
    }
    streamRef.current = stream;

    try {
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });
          const url = URL.createObjectURL(blob);
          audioUrlRef.current = url;
          setAudioUrl(url);
        }
        onComplete({
          transcript: finalTranscriptRef.current.trim(),
          audioUrl: audioUrlRef.current,
        });
      };
      recorder.start();
    } catch {
      setError("Recording isn't supported in this browser.");
      stopTracks();
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      try {
        const recognition = new SR();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang =
          typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";
        recognition.onresult = (event) => {
          let interimText = "";
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const result = event.results[i];
            const text = result[0]?.transcript ?? "";
            if (result.isFinal) {
              finalTranscriptRef.current =
                `${finalTranscriptRef.current} ${text}`.trim();
            } else {
              interimText += text;
            }
          }
          setInterim(interimText);
        };
        recognition.onerror = () => {
          /* transient errors (no-speech, network) — keep recording audio */
        };
        recognitionRef.current = recognition;
        recognition.start();
      } catch {
        recognitionRef.current = null;
      }
    }

    timerRef.current = setInterval(() => setElapsed((n) => n + 1), 1000);
    setStatus("recording");
  }, [onComplete, stopTracks]);

  const stop = useCallback(() => {
    cleanupTimer();
    setInterim("");
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    } catch {
      /* ignore */
    }
    stopTracks();
    setStatus("recorded");
  }, [cleanupTimer, stopTracks]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        {status !== "recording" ? (
          <button
            type="button"
            onClick={start}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            {status === "recorded" ? "Record again" : "Start recording"}
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <span className="h-2.5 w-2.5 rounded-sm bg-slate-900" />
            Stop
          </button>
        )}

        {status === "recording" && (
          <span className="flex items-center gap-2 text-sm text-slate-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            Recording {formatElapsed(elapsed)}
          </span>
        )}
        {status === "recorded" && elapsed > 0 && (
          <span className="text-sm text-slate-500">
            Last take: {formatElapsed(elapsed)}
          </span>
        )}
      </div>

      {interim && (
        <p className="mt-3 text-sm italic text-slate-500">{interim}…</p>
      )}

      {error && (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </p>
      )}

      {audioUrl && status !== "recording" && (
        <audio controls src={audioUrl} className="mt-3 w-full">
          Your browser doesn&apos;t support audio playback.
        </audio>
      )}
    </div>
  );
}
