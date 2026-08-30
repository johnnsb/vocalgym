import type { EffectiveResult, ObservableSignals } from "@/lib/types";
import { SIGNAL_LABELS } from "@/lib/rubric";

function toneClass(score: number): string {
  if (score >= 66) return "text-emerald-600";
  if (score >= 48) return "text-amber-600";
  return "text-rose-600";
}

interface Props {
  result: EffectiveResult;
  signals?: ObservableSignals | null;
  compact?: boolean;
}

export default function EffectiveScore({ result, signals, compact }: Props) {
  const readout = signals
    ? (Object.keys(SIGNAL_LABELS) as (keyof ObservableSignals)[])
        .filter((k) => signals[k] !== null)
        .map((k) => `${SIGNAL_LABELS[k]} ${signals[k]}`)
    : [];

  return (
    <div
      className={
        compact
          ? "space-y-3"
          : "rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      }
    >
      <div className="flex items-baseline gap-3">
        <span className={`text-3xl font-bold tabular-nums ${toneClass(result.score)}`}>
          {result.score}
        </span>
        <span className="text-sm text-slate-400">/ 100</span>
        <span className="text-sm font-semibold text-slate-700">
          {result.label}
        </span>
        <span className="ml-auto text-xs text-slate-400">
          Effective · rough estimate from this take
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {result.rows.map((row) => (
          <li key={row.attribute}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-700">
                {row.label}
                <span className="ml-1.5 text-xs font-normal text-slate-400">
                  {row.weight}%
                </span>
              </span>
              <span className="tabular-nums text-slate-600">
                {row.score === null ? "—" : `${row.score}/100`}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-slate-800"
                style={{ width: `${row.score ?? 0}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {row.score === null
                ? `not scored — needs ${row.missingSignals.join(", ")}`
                : `from ${row.usedSignals.join(", ")}`}
            </div>
          </li>
        ))}
      </ul>

      {readout.length > 0 && (
        <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-400">
          Signals (0–100): {readout.join(" · ")}
        </p>
      )}
    </div>
  );
}
