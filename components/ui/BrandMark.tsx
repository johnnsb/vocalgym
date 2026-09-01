import type { CSSProperties, HTMLAttributes } from "react";

// Ported from the VocalGym Design System (components/core/BrandMark.jsx).
// The logo ships as pre-colored PNGs in /public/brand/. Ink on light, Canvas
// on dark, Ember only for the mark as a standalone accent. Lockup is horizontal
// only — there is no stacked lockup.

type Variant = "lockup" | "mark" | "wordmark";
type Tone = "ink" | "inverse" | "ember";

const RATIOS: Record<Variant, number> = {
  lockup: 4.477,
  mark: 1.471,
  wordmark: 4.424,
};

function src(variant: Variant, tone: Tone): string {
  const suffix = tone === "inverse" ? "-inverse" : tone === "ember" ? "-ember" : "";
  return `/brand/logo-${variant}${suffix}.png`;
}

export interface BrandMarkProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "title"> {
  variant?: Variant;
  size?: number;
  tone?: Tone;
  title?: string;
  style?: CSSProperties;
}

export function BrandMark({
  variant = "lockup",
  size = 24,
  tone = "ink",
  title = "VocalGym",
  style,
  ...rest
}: BrandMarkProps) {
  const ratio = RATIOS[variant] || RATIOS.lockup;
  // wordmark has no Ember variant — fall back to Ink.
  const t: Tone = variant === "wordmark" && tone === "ember" ? "ink" : tone;

  return (
    <span
      role="img"
      aria-label={title}
      style={{
        display: "inline-block",
        height: size,
        width: Math.round(size * ratio),
        flex: "0 0 auto",
        backgroundImage: `url("${src(variant, t)}")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundSize: "contain",
        ...style,
      }}
      {...rest}
    />
  );
}
