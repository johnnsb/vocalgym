"use client";

import {
  useState,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Icon } from "./Icon";

// Ported from the VocalGym Design System (components/core/Tag.jsx).
// Selected = Ink fill. Used for choosable chips (e.g. the rubric picker).

export interface TagProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "onClick"> {
  children?: ReactNode;
  icon?: string;
  selected?: boolean;
  onRemove?: (e: MouseEvent) => void;
  onClick?: (e: MouseEvent) => void;
}

export function Tag({
  children,
  icon,
  selected = false,
  onRemove,
  onClick,
  style,
  ...rest
}: TagProps) {
  const [hover, setHover] = useState(false);
  const interactive = Boolean(onClick);

  return (
    <span
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        height: 32,
        padding: onRemove ? "0 8px 0 12px" : "0 13px",
        borderRadius: "var(--radius-chip)",
        fontFamily: "var(--font-ui)",
        fontSize: "14px",
        fontWeight: 500,
        cursor: interactive ? "pointer" : "default",
        transition:
          "background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
        background: selected
          ? "var(--ink)"
          : hover && interactive
            ? "var(--surface-hover)"
            : "var(--surface-card)",
        color: selected ? "var(--text-inverse)" : "var(--text-body)",
        border: `1px solid ${selected ? "var(--ink)" : "var(--border-default)"}`,
        ...style,
      }}
      {...rest}
    >
      {icon ? <Icon name={icon} size={15} /> : null}
      {children}
      {onRemove ? (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onRemove(e);
          }}
          style={{
            display: "inline-flex",
            padding: 3,
            borderRadius: "var(--radius-pill)",
            cursor: "pointer",
            opacity: 0.6,
          }}
        >
          <Icon name="x" size={13} />
        </span>
      ) : null}
    </span>
  );
}
