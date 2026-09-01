"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

// Ported from the VocalGym Design System (components/forms/Switch.jsx).

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: (next: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  style?: CSSProperties;
}

export function Switch({
  checked,
  defaultChecked,
  disabled = false,
  onChange,
  label,
  description,
  style,
}: SwitchProps) {
  const [internal, setInternal] = useState(Boolean(defaultChecked));
  const on = checked === undefined ? internal : checked;

  function toggle() {
    if (disabled) return;
    if (checked === undefined) setInternal(!on);
    onChange?.(!on);
  }

  const track = (
    <span
      onClick={toggle}
      role="switch"
      aria-checked={on}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        width: 40,
        height: 23,
        flex: "0 0 auto",
        padding: 2,
        borderRadius: "var(--radius-pill)",
        background: on ? "var(--ember)" : "var(--fog)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background var(--dur-base) var(--ease-out)",
      }}
    >
      <span
        style={{
          width: 19,
          height: 19,
          borderRadius: "50%",
          background: "var(--white)",
          boxShadow: "var(--shadow-sm)",
          transform: on ? "translateX(17px)" : "translateX(0)",
          transition: "transform var(--dur-base) var(--ease-settle)",
        }}
      />
    </span>
  );

  if (!label) return <span style={style}>{track}</span>;

  return (
    <label style={{ display: "inline-flex", alignItems: "flex-start", gap: 12, ...style }}>
      {track}
      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
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
    </label>
  );
}
