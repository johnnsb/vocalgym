"use client";

import { useState, type CSSProperties, type InputHTMLAttributes } from "react";
import { Icon } from "./Icon";

// Ported from the VocalGym Design System (components/forms/Input.jsx).

type Size = "sm" | "md" | "lg";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: Size;
  icon?: string;
  invalid?: boolean;
  /** style for the wrapping element (the <input> itself is styled internally) */
  wrapperStyle?: CSSProperties;
}

export function Input({
  size = "md",
  icon,
  invalid = false,
  disabled = false,
  style,
  wrapperStyle,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [focus, setFocus] = useState(false);
  const h =
    size === "sm"
      ? "var(--control-h-sm)"
      : size === "lg"
        ? "var(--control-h-lg)"
        : "var(--control-h)";

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
      {icon ? (
        <span
          style={{
            position: "absolute",
            left: 13,
            display: "inline-flex",
            color: focus ? "var(--text-body)" : "var(--text-muted)",
            pointerEvents: "none",
          }}
        >
          <Icon name={icon} size={17} />
        </span>
      ) : null}
      <input
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
          padding: icon ? "0 14px 0 39px" : "0 14px",
          fontFamily: "var(--font-body)",
          fontSize: size === "sm" ? "14px" : "var(--text-body-sm-size)",
          color: "var(--text-primary)",
          background: disabled ? "var(--surface-sunken)" : "var(--surface-card)",
          border: `1px solid ${
            invalid
              ? "var(--status-critical)"
              : focus
                ? "var(--ember)"
                : "var(--border-default)"
          }`,
          borderRadius: "var(--radius-control)",
          boxShadow: focus
            ? "0 0 0 3px var(--focus-ring-soft)"
            : "var(--shadow-inset-sunken)",
          outline: "none",
          transition:
            "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
          ...style,
        }}
        {...rest}
      />
    </div>
  );
}
