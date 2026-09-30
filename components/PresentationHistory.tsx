"use client";

import { useState } from "react";
import PresentationFeedbackSections from "./PresentationFeedbackSections";
import { formatDuration } from "@/lib/presentationPrep";
import type { PresentationTake } from "@/lib/types";
import { Card, Icon, IconButton } from "@/components/ui";

interface Props {
  takes: PresentationTake[];
  onDelete: (id: string) => void;
}

export default function PresentationHistory({ takes, onDelete }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  if (!takes.length) {
    return (
      <Card tone="sunken" padding="sm">
        <p className="text-body-sm text-text-muted">Your runs will show up here.</p>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      <h2 className="text-h4 text-text-primary">Past runs</h2>
      {takes.map((t) => (
        <Card key={t.id} tone="sunken" padding="sm" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setOpen(open === t.id ? null : t.id)}
              className="flex flex-1 items-center gap-2 text-left text-body-sm text-text-body"
            >
              <Icon name={open === t.id ? "chevron-down" : "chevron-right"} size={14} />
              <span className="font-medium text-text-primary">
                {new Date(t.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
              <span className="text-text-muted">· {formatDuration(t.durationSec)}</span>
              {t.effective && <span className="text-text-muted">· Effective {Math.round(t.effective.score)}</span>}
              {t.talkTitle && <span className="truncate text-text-muted">· {t.talkTitle}</span>}
            </button>
            <IconButton icon="trash-2" label="Delete this run" onClick={() => onDelete(t.id)} />
          </div>
          {open === t.id && <PresentationFeedbackSections feedback={t.feedback} />}
        </Card>
      ))}
    </div>
  );
}
