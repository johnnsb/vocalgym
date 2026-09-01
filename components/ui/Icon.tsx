import type { CSSProperties } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Check,
  Clock,
  Copy,
  Download,
  DoorOpen,
  Hand,
  Home,
  Info,
  LayoutList,
  Library,
  Lock,
  MessageSquare,
  Mic,
  Pause,
  Play,
  Presentation,
  RotateCcw,
  Search,
  Settings,
  Shield,
  SkipForward,
  Square,
  Sunrise,
  Timer,
  Trash2,
  TrendingUp,
  Upload,
  UserX,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";

/**
 * Design-system Icon. Keeps the DS's string-name API (`name="chevron-down"`) so
 * component prompt-docs port directly, but renders from `lucide-react`.
 *
 * Only the glyphs the design system sanctions are registered here — an explicit
 * allow-list keeps the bundle small (a wildcard import pulls the whole library).
 * Add a glyph to REGISTRY when a new one is genuinely needed.
 */
const REGISTRY: Record<string, LucideIcon> = {
  activity: Activity,
  "alert-circle": AlertCircle,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  clock: Clock,
  copy: Copy,
  "door-open": DoorOpen,
  download: Download,
  hand: Hand,
  home: Home,
  info: Info,
  "layout-list": LayoutList,
  library: Library,
  lock: Lock,
  "message-square": MessageSquare,
  mic: Mic,
  pause: Pause,
  play: Play,
  presentation: Presentation,
  "rotate-ccw": RotateCcw,
  search: Search,
  settings: Settings,
  shield: Shield,
  "skip-forward": SkipForward,
  square: Square,
  sunrise: Sunrise,
  timer: Timer,
  "trash-2": Trash2,
  "trending-up": TrendingUp,
  upload: Upload,
  "user-x": UserX,
  video: Video,
  x: X,
};

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
  const Glyph = REGISTRY[name];
  if (!Glyph) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[ui/Icon] "${name}" is not in the icon registry`);
    }
    return null;
  }
  return (
    <Glyph
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
