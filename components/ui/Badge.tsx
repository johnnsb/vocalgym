import type { HTMLAttributes, ReactNode } from "react";

// Ported from the VocalGym Design System (components/core/Badge.jsx).

type Tone = "plain" | "outline" | "accent" | "positive" | "critical" | "inverse";

const TONES: Record<Tone, { background: string; color: string; border: string }> = {
  plain: { background: "var(--surface-sunken)", color: "var(--text-body)", border: "1px solid transparent" },
  outline: { background: "transparent", color: "var(--text-body)", border: "1px solid var(--border-default)" },
  accent: { background: "var(--surface-accent-tint)", color: "var(--ember-text)", border: "1px solid var(--ember-line)" },
  positive: { background: "var(--status-positive-tint)", color: "var(--status-positive)", border: "1px solid transparent" },
  critical: { background: "var(--status-critical-tint)", color: "var(--status-critical)", border: "1px solid transparent" },
  inverse: { background: "rgba(255,255,255,0.10)", color: "var(--text-inverse)", border: "1px solid var(--border-inverse)" },
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode;
  tone?: Tone;
  dot?: boolean;
}

export function Badge({ children, tone = "plain", dot = false, style, ...rest }: BadgeProps) {
  const t = TONES[tone] || TONES.plain;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 24,
        padding: "0 10px",
        borderRadius: "var(--radius-chip)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption-size)",
        lineHeight: 1,
        fontWeight: 600,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
        ...t,
        ...style,
      }}
      {...rest}
    >
      {dot ? (
        <span
          style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", opacity: 0.85 }}
        />
      ) : null}
      {children}
    </span>
  );
}
