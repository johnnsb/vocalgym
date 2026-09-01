import type { NonverbalMetrics, NonverbalSpan } from "@/lib/types";
import { Badge, Card } from "@/components/ui";

function clock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const spanText = (spans: NonverbalSpan[]) =>
  spans.map((s) => `${clock(s.startSec)}–${clock(s.endSec)}`).join(", ");

interface Props {
  metrics: NonverbalMetrics;
  compact?: boolean;
}

export default function NonverbalSummary({ metrics, compact = false }: Props) {
  const stats = [
    { label: "Eye contact", value: `${metrics.eyeContact.facingForwardPct}%` },
    { label: "Upright", value: `${metrics.posture.uprightPct}%` },
    { label: "Smiles", value: `${metrics.expressiveness.smileCount}` },
    {
      label: "Brow tension",
      value: `${metrics.expressiveness.browTensionPct}%`,
    },
  ];

  const notes: string[] = [];
  if (metrics.eyeContact.awaySpans.length) {
    notes.push(`Looked away: ${spanText(metrics.eyeContact.awaySpans)}`);
  }
  if (metrics.posture.leanForwardSpans.length) {
    notes.push(`Leaned in: ${spanText(metrics.posture.leanForwardSpans)}`);
  }
  if (metrics.expressiveness.browTensionSpans.length) {
    notes.push(
      `Brow tension: ${spanText(metrics.expressiveness.browTensionSpans)}`,
    );
  }
  if (metrics.posture.swayNote) notes.push(metrics.posture.swayNote);
  if (metrics.posture.headTilt !== "level") {
    notes.push(`Head ${metrics.posture.headTilt} on average`);
  }

  const body = (
    <>
      <h3
        className={`${compact ? "text-caption" : "mb-3 text-body-sm"} font-semibold text-text-primary`}
      >
        Nonverbal signals{" "}
        <span className="font-normal text-text-muted">
          · rough webcam estimate
        </span>
      </h3>

      <div className="flex flex-wrap gap-2">
        {stats.map((s) => (
          <Badge key={s.label} tone="plain">
            <span className="font-semibold text-text-primary">{s.value}</span>
            <span className="font-normal text-text-muted">{s.label}</span>
          </Badge>
        ))}
      </div>

      {notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-caption text-text-muted">
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </>
  );

  if (compact) return <div className="space-y-2">{body}</div>;
  return <Card padding="sm">{body}</Card>;
}
