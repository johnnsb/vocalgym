"use client";

import { useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { Icon } from "./Icon";

// Ported from the VocalGym Design System (components/core/Button.jsx).
// One Ember `primary` per view; everything else secondary / ghost.

type Variant = "primary" | "secondary" | "ghost" | "inverse" | "link";
type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, { height: string; padding: string; font: string }> = {
  sm: { height: "var(--control-h-sm)", padding: "0 14px", font: "14px" },
  md: { height: "var(--control-h)", padding: "0 20px", font: "var(--text-label-size)" },
  lg: { height: "var(--control-h-lg)", padding: "0 26px", font: "17px" },
};

const VARIANTS: Record<
  Variant,
  { base: CSSProperties; hover: CSSProperties }
> = {
  primary: {
    base: { background: "var(--surface-accent)", color: "#FFF8EE", border: "1px solid transparent" },
    hover: { background: "var(--ember-press)" },
  },
  secondary: {
    base: { background: "var(--surface-card)", color: "var(--text-primary)", border: "1px solid var(--border-default)" },
    hover: { background: "var(--surface-hover)", border: "1px solid var(--border-strong)" },
  },
  ghost: {
    base: { background: "transparent", color: "var(--text-body)", border: "1px solid transparent" },
    hover: { background: "var(--surface-hover)" },
  },
  inverse: {
    base: { background: "var(--canvas)", color: "var(--ink)", border: "1px solid transparent" },
    hover: { background: "#FFFFFF" },
  },
  link: {
    base: { background: "transparent", color: "var(--text-accent)", border: "1px solid transparent", padding: 0, height: "auto" },
    hover: { color: "var(--ink)" },
  },
};

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  children?: ReactNode;
  variant?: Variant;
  size?: Size;
  /** Lucide icon name, rendered before the label. */
  icon?: string;
  /** Lucide icon name, rendered after the label. */
  iconAfter?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconAfter,
  fullWidth = false,
  disabled = false,
  type = "button",
  style,
  ...rest
}: ButtonProps) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size] || SIZES.md;

  return (
    <button
      type={type}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPress(false);
      }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        display: fullWidth ? "flex" : "inline-flex",
        width: fullWidth ? "100%" : undefined,
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--gap-inline)",
        height: s.height,
        padding: s.padding,
        fontFamily: "var(--font-ui)",
        fontSize: s.font,
        lineHeight: "var(--text-label-line)",
        fontWeight: "var(--text-label-weight)",
        letterSpacing: "var(--text-label-tracking)",
        borderRadius: "var(--radius-control)",
        cursor: disabled ? "not-allowed" : "pointer",
        transition:
          "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), transform var(--dur-instant) var(--ease-out)",
        transform: press && !disabled ? "scale(var(--press-scale))" : "none",
        whiteSpace: "nowrap",
        ...v.base,
        ...(hover && !disabled ? v.hover : null),
        ...(disabled
          ? {
              background: variant === "primary" ? "var(--fog-2)" : "transparent",
              color: "var(--text-disabled)",
              border: "1px solid var(--border-subtle)",
            }
          : null),
        ...style,
      }}
      {...rest}
    >
      {icon ? <Icon name={icon} size={size === "sm" ? 16 : 18} /> : null}
      {children}
      {iconAfter ? <Icon name={iconAfter} size={size === "sm" ? 16 : 18} /> : null}
    </button>
  );
}
