"use client";

import type { CSSProperties } from "react";

// Ported from the VocalGym Design System (components/navigation/Tabs.jsx).
// `underline` (Ember 2px active line) is the default; `segmented` for compact
// toggles.

type Variant = "underline" | "segmented";
type TabItem = string | { value: string; label: string; count?: number };

export interface TabsProps {
  tabs: TabItem[];
  value?: string;
  onChange?: (value: string) => void;
  variant?: Variant;
  style?: CSSProperties;
}

export function Tabs({
  tabs = [],
  value,
  onChange,
  variant = "underline",
  style,
}: TabsProps) {
  const items = tabs.map((t) =>
    typeof t === "string" ? { value: t, label: t } : t,
  );
  const active = value !== undefined ? value : items[0]?.value;

  if (variant === "segmented") {
    return (
      <div
        style={{
          display: "inline-flex",
          gap: 2,
          padding: 3,
          background: "var(--surface-sunken)",
          borderRadius: "var(--radius-md)",
          ...style,
        }}
      >
        {items.map((t) => {
          const on = t.value === active;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange?.(t.value)}
              style={{
                height: 32,
                padding: "0 14px",
                border: "1px solid transparent",
                borderRadius: "var(--radius-sm)",
                fontFamily: "var(--font-ui)",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
                background: on ? "var(--surface-card)" : "transparent",
                color: on ? "var(--text-primary)" : "var(--text-muted)",
                boxShadow: on ? "var(--shadow-sm)" : "none",
                transition:
                  "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-6)",
        borderBottom: "1px solid var(--border-subtle)",
        ...style,
      }}
    >
      {items.map((t) => {
        const on = t.value === active;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange?.(t.value)}
            style={{
              position: "relative",
              padding: "0 2px 12px",
              background: "none",
              border: "none",
              borderBottom: `2px solid ${on ? "var(--ember)" : "transparent"}`,
              marginBottom: -1,
              fontFamily: "var(--font-ui)",
              fontSize: "var(--text-label-size)",
              fontWeight: on ? 600 : 500,
              letterSpacing: "var(--text-label-tracking)",
              color: on ? "var(--text-primary)" : "var(--text-muted)",
              cursor: "pointer",
              transition:
                "color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
            }}
          >
            {t.label}
            {t.count !== undefined ? (
              <span
                style={{
                  marginLeft: 7,
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-caption-size)",
                  color: "var(--text-muted)",
                }}
              >
                {t.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
