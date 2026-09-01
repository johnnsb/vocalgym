import type { CSSProperties, HTMLAttributes } from "react";

// Ported from the VocalGym Design System (components/core/Waveform.jsx).
// Deterministic bars so static renders look identical. `live` breathes on a
// 3.2s cycle (vg-breath); `progress` fills bars left-to-right.

type Tone = "ember" | "ink" | "inverse";

function level(i: number, seed: number): number {
  const x = Math.sin((i + 1) * 12.9898 + seed) * 43758.5453;
  return 0.22 + (x - Math.floor(x)) * 0.78;
}

export interface WaveformProps extends HTMLAttributes<HTMLDivElement> {
  bars?: number;
  height?: number;
  tone?: Tone;
  live?: boolean;
  /** 0–1; bars up to this fraction render as "played". */
  progress?: number;
  seed?: number;
  style?: CSSProperties;
}

export function Waveform({
  bars = 48,
  height = 56,
  tone = "ember",
  live = false,
  progress = 1,
  seed = 3,
  style,
  ...rest
}: WaveformProps) {
  const colors =
    {
      ember: { on: "var(--ember)", off: "var(--ember-line)" },
      ink: { on: "var(--charcoal)", off: "var(--fog)" },
      inverse: { on: "var(--canvas)", off: "rgba(250,247,241,0.24)" },
    }[tone] || { on: "var(--ember)", off: "var(--ember-line)" };

  return (
    <div
      aria-hidden="true"
      style={{ display: "flex", alignItems: "center", gap: 3, height, ...style }}
      {...rest}
    >
      {Array.from({ length: bars }).map((_, i) => {
        const played = i / bars <= progress;
        return (
          <span
            key={i}
            style={{
              flex: 1,
              minWidth: 2,
              height: `${Math.round(level(i, seed) * height)}px`,
              borderRadius: "var(--radius-pill)",
              background: played ? colors.on : colors.off,
              transition:
                "background var(--dur-base) var(--ease-out), height var(--dur-base) var(--ease-out)",
              animation: live
                ? `vg-breath var(--dur-breath) var(--ease-in-out) ${i * 40}ms infinite`
                : "none",
            }}
          />
        );
      })}
    </div>
  );
}
