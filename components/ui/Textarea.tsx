"use client";

import { useState, type TextareaHTMLAttributes } from "react";

// Ported from the VocalGym Design System (components/forms/Textarea.jsx).

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({
  rows = 4,
  invalid = false,
  disabled = false,
  style,
  onFocus,
  onBlur,
  ...rest
}: TextareaProps) {
  const [focus, setFocus] = useState(false);
  return (
    <textarea
      rows={rows}
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
        padding: "11px 14px",
        fontFamily: "var(--font-body)",
        fontSize: "var(--text-body-sm-size)",
        lineHeight: "var(--text-body-sm-line)",
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
        resize: "vertical",
        transition:
          "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
        ...style,
      }}
      {...rest}
    />
  );
}
