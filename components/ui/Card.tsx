"use client";

import {
  useState,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from "react";

// Ported from the VocalGym Design System (components/core/Card.jsx).
// White on Canvas, 12px radius, hairline border, soft shadow. Nested blocks use
// tone="sunken" (Parchment, no border, no shadow).

type Tone = "raised" | "flat" | "sunken" | "inverse" | "accent";
type Padding = "sm" | "md" | "lg";

const PADS: Record<Padding, string> = {
  sm: "var(--pad-card-sm)",
  md: "var(--pad-card)",
  lg: "var(--space-8)",
};

const TONES: Record<Tone, CSSProperties> = {
  raised: { background: "var(--surface-card)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-sm)" },
  flat: { background: "var(--surface-card)", border: "1px solid var(--border-subtle)", boxShadow: "none" },
  sunken: { background: "var(--surface-sunken)", border: "1px solid transparent", boxShadow: "none" },
  inverse: { background: "var(--surface-inverse)", border: "1px solid var(--border-inverse)", boxShadow: "none", color: "var(--text-inverse)" },
  accent: { background: "var(--surface-accent-tint)", border: "1px solid var(--ember-line)", boxShadow: "none" },
};

export interface CardProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
  tone?: Tone;
  padding?: Padding;
  interactive?: boolean;
  as?: ElementType;
  /** passthrough when `as` is a link component */
  href?: string;
}

export function Card({
  children,
  tone = "raised",
  padding = "md",
  interactive = false,
  as: Tag = "div",
  style,
  ...rest
}: CardProps) {
  const [hover, setHover] = useState(false);
  const t = TONES[tone] || TONES.raised;

  return (
    <Tag
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderRadius: "var(--radius-card)",
        padding: PADS[padding] || PADS.md,
        transition:
          "box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out)",
        cursor: interactive ? "pointer" : undefined,
        ...t,
        ...(interactive && hover
          ? {
              boxShadow: "var(--shadow-md)",
              transform: "translateY(var(--lift-hover))",
              borderColor: "var(--border-default)",
            }
          : null),
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
