"use client";

import {
  useState,
  type CSSProperties,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { Icon } from "./Icon";

// Ported from the VocalGym Design System (components/forms/Select.jsx).
// Accepts `options` (string | {value,label}) for simple lists, or `children`
// <option> nodes for full control.

type Size = "sm" | "md";
type Option = string | { value: string; label: string };

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  options?: Option[];
  size?: Size;
  children?: ReactNode;
  wrapperStyle?: CSSProperties;
}

export function Select({
  options,
  size = "md",
  disabled = false,
  style,
  wrapperStyle,
  children,
  onFocus,
  onBlur,
  ...rest
}: SelectProps) {
  const [focus, setFocus] = useState(false);
  const h = size === "sm" ? "var(--control-h-sm)" : "var(--control-h)";

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        width: "100%",
        ...wrapperStyle,
      }}
    >
      <select
        disabled={disabled}
        onFocus={(e) => {
          setFocus(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          onBlur?.(e);
        }}
        style={{
          width: "100%",
          height: h,
          padding: "0 38px 0 14px",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-body-sm-size)",
          color: "var(--text-primary)",
          background: disabled ? "var(--surface-sunken)" : "var(--surface-card)",
          border: `1px solid ${focus ? "var(--ember)" : "var(--border-default)"}`,
          borderRadius: "var(--radius-control)",
          boxShadow: focus
            ? "0 0 0 3px var(--focus-ring-soft)"
            : "var(--shadow-inset-sunken)",
          appearance: "none",
          outline: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          transition:
            "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
          ...style,
        }}
        {...rest}
      >
        {children ??
          (options ?? []).map((o) => {
            const value = typeof o === "string" ? o : o.value;
            const label = typeof o === "string" ? o : o.label;
            return (
              <option key={value} value={value}>
                {label}
              </option>
            );
          })}
      </select>
      <span
        style={{
          position: "absolute",
          right: 13,
          display: "inline-flex",
          color: "var(--text-muted)",
          pointerEvents: "none",
        }}
      >
        <Icon name="chevron-down" size={16} />
      </span>
    </div>
  );
}
