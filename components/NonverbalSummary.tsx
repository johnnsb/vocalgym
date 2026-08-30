import type { NonverbalMetrics, NonverbalSpan } from "@/lib/types";

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

  return (
    <div
      className={
        compact
          ? "space-y-2"
          : "rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      }
    >
      <h3
        className={`${
          compact ? "text-xs" : "mb-3 text-sm"
        } font-semibold text-slate-700`}
      >
        Nonverbal signals{" "}
        <span className="font-normal text-slate-400">
          · rough webcam estimate
        </span>
      </h3>

      <div className="flex flex-wrap gap-2">
        {stats.map((s) => (
          <span
            key={s.label}
            className="inline-flex items-baseline gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs"
          >
            <span className="font-semibold text-slate-800">{s.value}</span>
            <span className="text-slate-500">{s.label}</span>
          </span>
        ))}
      </div>

      {notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-slate-500">
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
