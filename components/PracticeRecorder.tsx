"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NonverbalAnalyzer } from "@/lib/mediapipe";
import { summarizeNonverbal, type NonverbalRawSample } from "@/lib/nonverbal";
import { AudioMeter } from "@/lib/audioMeter";
import type { AudioSummary, NonverbalMetrics } from "@/lib/types";
import { Button, Callout } from "@/components/ui";

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
type VideoState = "off" | "loading" | "ready" | "error";

interface Props {
  disabled?: boolean;
  /** Shown next to the camera preview so it stays visible while recording. */
  script?: string;
  /** Fires each time a recording stops, with whatever was captured. */
  onComplete: (result: {
    transcript: string;
    audioUrl: string | null;
    durationSec: number;
    nonverbal: NonverbalMetrics | null;
    audio: AudioSummary | null;
  }) => void;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Reject if `promise` hasn't settled in `ms` — guards against a hung camera prompt. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
}

const WAVE_BARS = [
  { h: "40%", delay: "0ms" },
  { h: "75%", delay: "120ms" },
  { h: "100%", delay: "240ms" },
  { h: "60%", delay: "120ms" },
  { h: "45%", delay: "300ms" },
];

function Waveform({ active }: { active: boolean }) {
  return (
    <span className="flex h-4 items-center gap-[3px]" aria-hidden="true">
      {WAVE_BARS.map((bar, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full ${
            active ? "vg-wave-bar bg-live" : "bg-fog"
          }`}
          style={
            active ? { height: bar.h, animationDelay: bar.delay } : { height: "30%" }
          }
        />
      ))}
    </span>
  );
}

export default function PracticeRecorder({
  disabled,
  script,
  onComplete,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const [wantsVideo, setWantsVideo] = useState(false);
  const [videoState, setVideoState] = useState<VideoState>("off");
  const [videoError, setVideoError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const analyzerRef = useRef<NonverbalAnalyzer | null>(null);
  const samplesRef = useRef<NonverbalRawSample[]>([]);
  const sampleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recStartRef = useRef(0);
  const wantsVideoRef = useRef(false);
  const audioMeterRef = useRef<AudioMeter | null>(null);

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

  const stopSampling = useCallback(() => {
    if (sampleTimerRef.current != null) {
      clearInterval(sampleTimerRef.current);
      sampleTimerRef.current = null;
    }
  }, []);

  const teardownVideo = useCallback(() => {
    videoStreamRef.current?.getTracks().forEach((t) => t.stop());
    videoStreamRef.current = null;
    if (videoElRef.current) videoElRef.current.srcObject = null;
    analyzerRef.current?.close();
    analyzerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanupTimer();
      stopSampling();
      audioMeterRef.current?.stop();
      audioMeterRef.current = null;
      stopTracks();
      teardownVideo();
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, [cleanupTimer, stopSampling, stopTracks, teardownVideo]);

  const toggleCamera = useCallback(async () => {
    if (wantsVideo) {
      setWantsVideo(false);
      wantsVideoRef.current = false;
      setVideoState("off");
      setVideoError(null);
      teardownVideo();
      return;
    }

    setWantsVideo(true);
    wantsVideoRef.current = true;
    setVideoState("loading");
    setVideoError(null);

    let vStream: MediaStream;
    try {
      vStream = await withTimeout(
        navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        }),
        20000,
      );
    } catch {
      setWantsVideo(false);
      wantsVideoRef.current = false;
      setVideoState("error");
      setVideoError(
        "Couldn't start the camera — check the browser permission. You can still record audio only.",
      );
      return;
    }
    videoStreamRef.current = vStream;
    if (videoElRef.current) {
      videoElRef.current.srcObject = vStream;
      try {
        await videoElRef.current.play();
      } catch {
        /* muted autoplay should not fail; ignore */
      }
    }

    try {
      if (!analyzerRef.current) analyzerRef.current = new NonverbalAnalyzer();
      await withTimeout(analyzerRef.current.init(), 45000);
      setVideoState("ready");
    } catch {
      setVideoState("error");
      setVideoError(
        "Couldn't load the body-language models. Recording still works; camera analysis is off.",
      );
      teardownVideo();
      setWantsVideo(false);
      wantsVideoRef.current = false;
    }
  }, [wantsVideo, teardownVideo]);

  const startSamplers = useCallback(() => {
    samplesRef.current = [];
    recStartRef.current = performance.now();

    // A plain interval (not rAF) so sampling keeps going if the tab is
    // backgrounded; ~500ms matches "sample, don't process every frame". Audio
    // level is always read; the webcam only when the analyzer is ready.
    sampleTimerRef.current = setInterval(() => {
      audioMeterRef.current?.sample();

      const analyzer = analyzerRef.current;
      const v = videoElRef.current;
      if (!analyzer?.isReady || !v || v.readyState < 2) return;
      const now = performance.now();
      try {
        samplesRef.current.push(
          analyzer.sample(v, now, now - recStartRef.current),
        );
      } catch {
        /* skip this frame */
      }
    }, 500);
  }, []);

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

    audioMeterRef.current = new AudioMeter();
    audioMeterRef.current.start(stream);

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

        const durationMs = performance.now() - recStartRef.current;
        stopSampling();
        const audio = audioMeterRef.current?.summarize() ?? null;
        audioMeterRef.current?.stop();
        audioMeterRef.current = null;

        let nonverbal: NonverbalMetrics | null = null;
        if (samplesRef.current.length >= 3) {
          nonverbal = summarizeNonverbal(samplesRef.current, durationMs);
        }

        onComplete({
          transcript: finalTranscriptRef.current.trim(),
          audioUrl: audioUrlRef.current,
          durationSec: Math.round(durationMs / 1000),
          nonverbal,
          audio,
        });
      };
      recorder.start();
    } catch {
      setError("Recording isn't supported in this browser.");
      audioMeterRef.current?.stop();
      audioMeterRef.current = null;
      stopTracks();
      return;
    }

    startSamplers();

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
  }, [onComplete, startSamplers, stopSampling, stopTracks]);

  const stop = useCallback(() => {
    cleanupTimer();
    stopSampling();
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
  }, [cleanupTimer, stopSampling, stopTracks]);

  const recording = status === "recording";

  return (
    <div
      className={`rounded-card border p-5 shadow-sm transition-colors sm:p-6 ${
        recording
          ? "border-live/40 bg-status-critical-tint/40"
          : "border-border-subtle bg-surface-card"
      }`}
    >
      <label className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-body-sm text-text-body">
        <input
          type="checkbox"
          checked={wantsVideo}
          onChange={toggleCamera}
          disabled={disabled || recording || videoState === "loading"}
          className="h-[18px] w-[18px] rounded-xs border-border-default text-ember focus:ring-ember/40 disabled:opacity-50"
        />
        <span>Use camera for body-language feedback</span>
        {videoState === "loading" && (
          <span className="text-caption text-text-muted">loading models…</span>
        )}
        {videoState === "ready" && !recording && (
          <span className="text-caption font-medium text-status-positive">
            camera ready
          </span>
        )}
      </label>
      <p className="mt-1.5 text-caption leading-relaxed text-text-muted">
        Video is analyzed on your device with MediaPipe. Only the summary numbers
        are sent for feedback — the video never leaves your browser.
      </p>

      {/* Preview + a scrollable copy of the script, side by side, so you can
          watch yourself and read the script at the same time while recording.
          The <video> stays mounted (just hidden) so its ref is always valid. */}
      <div
        className={
          wantsVideo
            ? "mt-3 flex flex-col gap-3 sm:flex-row sm:items-stretch"
            : "hidden"
        }
      >
        <video
          ref={videoElRef}
          autoPlay
          muted
          playsInline
          className="w-full shrink-0 -scale-x-100 self-start rounded-md border border-border-subtle bg-ink sm:w-[260px]"
        />
        {script?.trim() && (
          <div className="max-h-56 min-w-0 flex-1 overflow-y-auto rounded-md border border-border-subtle bg-surface-sunken p-3 sm:max-h-[200px]">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              Script
            </p>
            <div className="whitespace-pre-wrap text-caption leading-relaxed text-text-body">
              {script}
            </div>
          </div>
        )}
      </div>

      {videoError && (
        <Callout tone="caution" className="mt-3">
          {videoError}
        </Callout>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        {!recording ? (
          <Button
            variant="primary"
            size="lg"
            icon="mic"
            onClick={start}
            disabled={disabled}
            className="w-full sm:w-auto"
          >
            {status === "recorded" ? "Record again" : "Start recording"}
          </Button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-control border border-live bg-surface-card px-6 py-3 text-body font-semibold text-live transition hover:bg-status-critical-tint sm:w-auto"
          >
            <span className="h-2.5 w-2.5 rounded-xs bg-live" />
            Stop recording
          </button>
        )}

        {recording && (
          <span className="flex items-center gap-2.5 text-body-sm font-medium text-live">
            <span className="h-2 w-2 animate-pulse rounded-full bg-live motion-reduce:animate-none" />
            <Waveform active />
            <span className="tabular-nums">
              Recording {formatElapsed(elapsed)}
            </span>
            {wantsVideo && (
              <span className="font-normal text-text-muted">· camera on</span>
            )}
          </span>
        )}
        {status === "recorded" && elapsed > 0 && (
          <span className="flex items-center gap-2.5 text-body-sm text-text-muted">
            <Waveform active={false} />
            <span className="tabular-nums">
              Last take {formatElapsed(elapsed)}
            </span>
          </span>
        )}
      </div>

      {interim && (
        <p className="mt-4 text-body-sm italic text-text-muted">{interim}…</p>
      )}

      {error && (
        <Callout tone="caution" className="mt-4">
          {error}
        </Callout>
      )}

      {audioUrl && !recording && (
        <audio controls src={audioUrl} className="mt-4 w-full">
          Your browser doesn&apos;t support audio playback.
        </audio>
      )}
    </div>
  );
}
