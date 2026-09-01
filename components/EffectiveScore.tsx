import type { EffectiveResult, ObservableSignals } from "@/lib/types";
import { SIGNAL_LABELS } from "@/lib/rubric";
import { Card } from "@/components/ui";

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

  const body = (
    <>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[30px] font-semibold tabular-nums text-ember-text">
          {result.score}
        </span>
        <span className="text-body-sm text-text-muted">/ 100</span>
        <span className="text-body-sm font-semibold text-text-primary">
          {result.label}
        </span>
        <span className="ml-auto text-caption text-text-muted">
          Effective · rough estimate from this take
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {result.rows.map((row) => (
          <li key={row.attribute}>
            <div className="flex items-center justify-between gap-3 text-body-sm">
              <span className="font-medium text-text-primary">
                {row.label}
                <span className="ml-1.5 text-caption font-normal text-text-muted">
                  {row.weight}%
                </span>
              </span>
              <span className="font-mono tabular-nums text-text-body">
                {row.score === null ? "—" : `${row.score}/100`}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-pill bg-surface-sunken">
              <div
                className="h-full rounded-pill bg-charcoal"
                style={{ width: `${row.score ?? 0}%` }}
              />
            </div>
            <div className="mt-1 text-caption text-text-muted">
              {row.score === null
                ? `not scored — needs ${row.missingSignals.join(", ")}`
                : `from ${row.usedSignals.join(", ")}`}
            </div>
          </li>
        ))}
      </ul>

      {readout.length > 0 && (
        <p className="mt-3 border-t border-border-subtle pt-2 text-caption text-text-muted">
          Signals (0–100): {readout.join(" · ")}
        </p>
      )}
    </>
  );

  if (compact) return <div className="space-y-3">{body}</div>;
  return <Card padding="sm">{body}</Card>;
}
