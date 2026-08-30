import type { AudioSummary } from "./types";

// RMS bands for a mic at typical gain. Device-dependent, so treat the output as
// a rough relative read of "too quiet / comfortable / too loud", not real dB.
const SILENCE = 0.01;
const SOFT = 0.03;
const LOUD = 0.32;

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
const mean = (a: number[]) =>
  a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;

/**
 * Taps the mic stream during a recording and collects an RMS level roughly
 * every time {@link sample} is called (the recorder does this on its 500ms
 * tick). {@link summarize} reduces the levels to an {@link AudioSummary}.
 */
export class AudioMeter {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private buf: Uint8Array<ArrayBuffer> | null = null;
  private levels: number[] = [];

  start(stream: MediaStream): void {
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.source = this.ctx.createMediaStreamSource(stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.buf = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
      this.source.connect(this.analyser);
      this.levels = [];
    } catch {
      this.ctx = null;
    }
  }

  sample(): void {
    if (!this.analyser || !this.buf) return;
    this.analyser.getByteTimeDomainData(this.buf);
    let sumSq = 0;
    for (let i = 0; i < this.buf.length; i += 1) {
      const v = (this.buf[i] - 128) / 128;
      sumSq += v * v;
    }
    this.levels.push(Math.sqrt(sumSq / this.buf.length));
  }

  summarize(): AudioSummary | null {
    const voiced = this.levels.filter((l) => l > SILENCE);
    if (voiced.length < 3) return null;
    const avg = mean(voiced);
    const within = (lo: number, hi: number) =>
      voiced.filter((l) => l >= lo && l <= hi).length / voiced.length;
    const sd = Math.sqrt(mean(voiced.map((l) => (l - avg) ** 2)));
    const steadiness = clamp(1 - sd / (avg || 1) / 0.9, 0, 1);
    return {
      samples: voiced.length,
      avgLevelPct: Math.round(clamp(avg / LOUD, 0, 1.3) * 100),
      comfortablePct: Math.round(within(SOFT, LOUD) * 100),
      steadinessPct: Math.round(steadiness * 100),
      tooSoftPct: Math.round(
        (voiced.filter((l) => l < SOFT).length / voiced.length) * 100,
      ),
      tooLoudPct: Math.round(
        (voiced.filter((l) => l > LOUD).length / voiced.length) * 100,
      ),
    };
  }

  stop(): void {
    try {
      this.source?.disconnect();
      void this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.ctx = null;
    this.analyser = null;
    this.source = null;
    this.buf = null;
  }
}
