import type { CSSProperties, ReactNode } from "react";
import { Icon } from "./Icon";

// Not in the DS component set, but built strictly from DS status tokens: the
// inline notice boxes VocalGym uses (demo-limit reached, form errors, import
// notices). "Reassurance is copy, not decoration" — keep the text plain.

type Tone = "info" | "caution" | "critical" | "positive";

const TONES: Record<
  Tone,
  { bg: string; fg: string; border: string; icon: string }
> = {
  info: {
    bg: "var(--surface-sunken)",
    fg: "var(--text-body)",
    border: "transparent",
    icon: "info",
  },
  caution: {
    bg: "var(--status-caution-tint)",
    fg: "var(--ember-text)",
    border: "var(--ember-line)",
    icon: "alert-circle",
  },
  critical: {
    bg: "var(--status-critical-tint)",
    fg: "var(--status-critical)",
    border: "transparent",
    icon: "alert-circle",
  },
  positive: {
    bg: "var(--status-positive-tint)",
    fg: "var(--status-positive)",
    border: "transparent",
    icon: "check",
  },
};

export interface CalloutProps {
  children: ReactNode;
  tone?: Tone;
  /** hide the leading icon */
  hideIcon?: boolean;
  style?: CSSProperties;
  className?: string;
}

export function Callout({
  children,
  tone = "info",
  hideIcon = false,
  style,
  className,
}: CalloutProps) {
  const t = TONES[tone] || TONES.info;
  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "12px 16px",
        borderRadius: "var(--radius-control)",
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.border}`,
        fontFamily: "var(--font-body)",
        fontSize: "var(--text-body-sm-size)",
        lineHeight: "var(--text-body-sm-line)",
        ...style,
      }}
    >
      {!hideIcon ? (
        <span style={{ marginTop: 2, flex: "0 0 auto" }}>
          <Icon name={t.icon} size={16} />
        </span>
      ) : null}
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}
