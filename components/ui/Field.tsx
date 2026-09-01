import type { CSSProperties, ReactNode } from "react";
import { Icon } from "./Icon";

// Ported from the VocalGym Design System (components/forms/Field.jsx).
// Label / hint / error wrapper. Forms in this product carry a lot of
// reassurance copy — hint is a first-class slot.

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  required = false,
  children,
  style,
}: FieldProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      {label ? (
        <label
          htmlFor={htmlFor}
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--text-primary)",
            letterSpacing: "0.005em",
          }}
        >
          {label}
          {required ? <span style={{ color: "var(--text-accent)" }}> *</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-caption-size)",
            color: "var(--status-critical)",
          }}
        >
          <Icon name="alert-circle" size={13} />
          {error}
        </span>
      ) : hint ? (
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-caption-size)",
            lineHeight: "var(--text-caption-line)",
            color: "var(--text-muted)",
          }}
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}
