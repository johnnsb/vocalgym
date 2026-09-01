"use client";

import { useState } from "react";
import type { PracticeAttempt } from "@/lib/types";
import FeedbackSections from "./FeedbackSections";
import NonverbalSummary from "./NonverbalSummary";
import EffectiveScore from "./EffectiveScore";
import { Icon } from "@/components/ui";

function formatStamp(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function previewOf(feedback: string): string {
  const lines = feedback
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim());
  for (const line of lines) {
    if (!line || /^#{1,6}\s+/.test(line)) continue;
    const bold = line.match(/^\*\*(.+?)\*\*\s*(?:[:：]|[—–-])?\s*(.*)$/);
    if (bold) {
      const rest = bold[2].trim();
      if (rest) return rest.replace(/[*#]/g, "");
      continue;
    }
    return line.replace(/[*#]/g, "");
  }
  return "";
}

interface Props {
  attempts: PracticeAttempt[];
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

const UNGROUPED = "__ungrouped__";

interface AttemptGroup {
  key: string;
  label: string;
  lastPracticed: number;
  attempts: PracticeAttempt[];
}

// Group by the script each attempt belongs to. Groups are ordered by most
// recently practiced; attempts within a group stay newest-first.
function groupByScript(attempts: PracticeAttempt[]): AttemptGroup[] {
  const map = new Map<string, PracticeAttempt[]>();
  for (const a of attempts) {
    const key = a.scriptId || UNGROUPED;
    const bucket = map.get(key);
    if (bucket) bucket.push(a);
    else map.set(key, [a]);
  }

  const groups: AttemptGroup[] = [];
  for (const [key, list] of Array.from(map.entries())) {
    list.sort((a, b) => b.createdAt - a.createdAt);
    const first = list[0];
    const label =
      first.scriptLabel?.trim() ||
      (first.situation?.trim()
        ? first.situation.trim().slice(0, 48)
        : "Untitled script");
    groups.push({
      key,
      label,
      lastPracticed: first.createdAt,
      attempts: list,
    });
  }
  groups.sort((a, b) => b.lastPracticed - a.lastPracticed);
  return groups;
}

export default function PastAttempts({ attempts, onDelete, onClearAll }: Props) {
  const groups = groupByScript(attempts);

  return (
    <div className="rounded-card border border-border-subtle bg-surface-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-body-sm font-semibold text-text-primary">
          Past attempts
          {attempts.length > 0 && (
            <span className="rounded-pill bg-surface-sunken px-1.5 py-0.5 text-caption font-medium text-text-muted">
              {attempts.length}
            </span>
          )}
        </h2>
        {attempts.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-caption text-text-muted underline underline-offset-2 transition hover:text-text-body"
          >
            Clear all
          </button>
        )}
      </div>

      {attempts.length === 0 ? (
        <p className="px-4 py-10 text-center text-caption leading-relaxed text-text-muted">
          Your practice attempts will show up here.
        </p>
      ) : (
        <div className="lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
          {groups.map((group) => (
            <section key={group.key}>
              <div className="sticky top-0 z-10 flex items-baseline gap-2 border-b border-border-subtle bg-surface-sunken/95 px-4 py-2 backdrop-blur">
                <h3 className="truncate text-caption font-semibold text-text-primary">
                  {group.label}
                </h3>
                <span className="flex-none text-[10px] font-medium text-text-muted">
                  {group.attempts.length}
                </span>
              </div>
              <ul className="divide-y divide-border-subtle">
                {group.attempts.map((attempt) => (
                  <AttemptRow
                    key={attempt.id}
                    attempt={attempt}
                    onDelete={onDelete}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function AttemptRow({
  attempt,
  onDelete,
}: {
  attempt: PracticeAttempt;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-2 px-4 py-3 text-left transition hover:bg-surface-hover"
      >
        <Icon
          name="chevron-right"
          size={14}
          className={`mt-0.5 flex-none text-text-muted transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-caption font-medium text-text-muted">
              {formatStamp(attempt.createdAt)}
            </span>
            {attempt.effective && (
              <span className="rounded-sm bg-surface-sunken px-1.5 py-0.5 text-[10px] font-semibold text-text-body">
                Effective {attempt.effective.score}
              </span>
            )}
          </span>
          {!open && (
            <span className="mt-0.5 block truncate text-caption text-text-body">
              {previewOf(attempt.feedback)}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4">
          {attempt.situation && (
            <p className="text-caption italic text-text-muted">
              {attempt.situation}
            </p>
          )}
          <div>
            <p className="mb-1 text-caption font-semibold uppercase tracking-wide text-text-muted">
              What you said
            </p>
            <p className="whitespace-pre-wrap text-caption leading-relaxed text-text-body">
              {attempt.transcript}
            </p>
          </div>
          {attempt.effective &&
            attempt.effective.rows.some((r) => r.score !== null) && (
              <EffectiveScore result={attempt.effective} compact />
            )}
          {attempt.nonverbal && (
            <NonverbalSummary metrics={attempt.nonverbal} compact />
          )}
          <div>
            <p className="mb-1.5 text-caption font-semibold uppercase tracking-wide text-text-muted">
              Coaching notes
            </p>
            <FeedbackSections feedback={attempt.feedback} compact />
          </div>
          <button
            type="button"
            onClick={() => onDelete(attempt.id)}
            className="text-caption text-text-muted underline underline-offset-2 transition hover:text-status-critical"
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}
