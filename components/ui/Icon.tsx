import * as icons from "lucide-react";
import type { CSSProperties } from "react";

/**
 * Design-system Icon. Keeps the DS's string-name API (`name="chevron-down"`) so
 * the component prompt-docs port directly, but renders from `lucide-react`
 * instead of fetching SVGs at runtime. Lucide, 2px stroke, inherits currentColor.
 */

type LucideComponent = (typeof icons)[keyof typeof icons];

function toPascal(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  title?: string;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
}

export function Icon({
  name,
  size = 20,
  color,
  title,
  className,
  style,
  strokeWidth = 2,
}: IconProps) {
  const key = toPascal(name);
  const Cmp = (icons as Record<string, LucideComponent>)[key] as
    | React.ComponentType<Record<string, unknown>>
    | undefined;

  if (!Cmp) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[ui/Icon] unknown lucide glyph: "${name}" (${key})`);
    }
    return null;
  }

  return (
    <Cmp
      size={size}
      color={color ?? "currentColor"}
      strokeWidth={strokeWidth}
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      className={className}
      style={{ flex: "0 0 auto", display: "inline-block", ...style }}
    />
  );
}
