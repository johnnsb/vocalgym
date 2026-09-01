"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "./Icon";

// Ported from the VocalGym Design System (components/forms/Checkbox.jsx).

export interface CheckboxProps {
  label?: ReactNode;
  description?: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: (next: boolean) => void;
  id?: string;
  style?: CSSProperties;
}

export function Checkbox({
  label,
  description,
  checked,
  defaultChecked,
  disabled = false,
  onChange,
  id,
  style,
}: CheckboxProps) {
  const [internal, setInternal] = useState(Boolean(defaultChecked));
  const on = checked === undefined ? internal : checked;

  function toggle() {
    if (disabled) return;
    if (checked === undefined) setInternal(!on);
    onChange?.(!on);
  }

  return (
    <label
      htmlFor={id}
      onClick={(e) => {
        e.preventDefault();
        toggle();
      }}
      style={{
        display: "inline-flex",
        alignItems: "flex-start",
        gap: 10,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 19,
          height: 19,
          marginTop: 3,
          flex: "0 0 auto",
          borderRadius: "var(--radius-xs)",
          background: on ? "var(--ember)" : "var(--surface-card)",
          border: `1px solid ${on ? "var(--ember)" : "var(--border-default)"}`,
          boxShadow: on ? "none" : "var(--shadow-inset-sunken)",
          color: "#FFF8EE",
          transition:
            "background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
        }}
      >
        {on ? <Icon name="check" size={13} /> : null}
      </span>
      {(label || description) && (
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {label ? (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body-sm-size)",
                lineHeight: "var(--text-body-sm-line)",
                color: "var(--text-primary)",
              }}
            >
              {label}
            </span>
          ) : null}
          {description ? (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-caption-size)",
                lineHeight: "var(--text-caption-line)",
                color: "var(--text-muted)",
              }}
            >
              {description}
            </span>
          ) : null}
        </span>
      )}
    </label>
  );
}
