import type { CSSProperties, ReactNode } from "react";

// Ported from the VocalGym Design System (components/forms/Radio.jsx).

export interface RadioProps {
  label?: ReactNode;
  description?: ReactNode;
  checked?: boolean;
  disabled?: boolean;
  onChange?: (value: string | undefined) => void;
  name?: string;
  value?: string;
  style?: CSSProperties;
}

export function Radio({
  label,
  description,
  checked = false,
  disabled = false,
  onChange,
  value,
  style,
}: RadioProps) {
  return (
    <label
      onClick={(e) => {
        e.preventDefault();
        if (!disabled) onChange?.(value);
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
          borderRadius: "50%",
          background: "var(--surface-card)",
          border: `1px solid ${checked ? "var(--ember)" : "var(--border-default)"}`,
          boxShadow: checked ? "none" : "var(--shadow-inset-sunken)",
          transition: "border-color var(--dur-fast) var(--ease-out)",
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: "var(--ember)",
            transform: checked ? "scale(1)" : "scale(0)",
            transition: "transform var(--dur-fast) var(--ease-settle)",
          }}
        />
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
