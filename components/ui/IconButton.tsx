"use client";

import { useState, type ButtonHTMLAttributes, type CSSProperties } from "react";
import { Icon } from "./Icon";

// Ported from the VocalGym Design System (components/core/IconButton.jsx).

type Variant = "ghost" | "outline" | "accent" | "inverse";
type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, number> = { sm: 32, md: 40, lg: 48 };

const VARIANTS: Record<
  Variant,
  { background: string; color: string; border: string; hover: CSSProperties }
> = {
  ghost: {
    background: "transparent",
    color: "var(--text-body)",
    border: "1px solid transparent",
    hover: { background: "var(--surface-hover)", color: "var(--text-primary)" },
  },
  outline: {
    background: "var(--surface-card)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-default)",
    hover: { background: "var(--surface-hover)", borderColor: "var(--border-strong)" },
  },
  accent: {
    background: "var(--surface-accent)",
    color: "#FFF8EE",
    border: "1px solid transparent",
    hover: { background: "var(--ember-press)" },
  },
  inverse: {
    background: "rgba(255,255,255,0.08)",
    color: "var(--text-inverse)",
    border: "1px solid var(--border-inverse)",
    hover: { background: "rgba(255,255,255,0.16)" },
  },
};

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  icon: string;
  /** Accessible label — also used as the tooltip title. */
  label: string;
  variant?: Variant;
  size?: Size;
  round?: boolean;
  disabled?: boolean;
}

export function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "md",
  round = false,
  disabled = false,
  style,
  ...rest
}: IconButtonProps) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  const dim = SIZES[size] || SIZES.md;
  const v = VARIANTS[variant] || VARIANTS.ghost;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPress(false);
      }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: dim,
        height: dim,
        borderRadius: round ? "var(--radius-pill)" : "var(--radius-control)",
        background: v.background,
        color: v.color,
        border: v.border,
        cursor: disabled ? "not-allowed" : "pointer",
        transition:
          "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), transform var(--dur-instant) var(--ease-out)",
        transform: press && !disabled ? "scale(var(--press-scale))" : "none",
        opacity: disabled ? 0.45 : 1,
        ...(hover && !disabled ? v.hover : null),
        ...style,
      }}
      {...rest}
    >
      <Icon name={icon} size={size === "sm" ? 16 : size === "lg" ? 22 : 18} />
    </button>
  );
}
