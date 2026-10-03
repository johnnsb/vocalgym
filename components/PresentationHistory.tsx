"use client";

import { useState } from "react";
import PresentationFeedbackSections from "./PresentationFeedbackSections";
import { formatDuration } from "@/lib/presentationPrep";
import type { PresentationTake } from "@/lib/types";
import { Button, Callout, Card, Icon, IconButton } from "@/components/ui";

interface Props {
  takes: PresentationTake[];
  onDelete: (id: string) => void;
  /** The history couldn't be loaded — say so instead of "no runs yet". */
  loadFailed?: boolean;
  /** A delete failed and the run was restored. */
  notice?: string | null;
}

export default function PresentationHistory({ takes, onDelete, loadFailed, notice }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  // Deleting a run is permanent, so the trash button asks inline first.
  const [confirming, setConfirming] = useState<string | null>(null);

  if (!takes.length) {
    return (
      <Card tone="sunken" padding="sm">
        <p className="text-body-sm text-text-muted">
          {loadFailed ? "Couldn't load your past runs. Refresh to try again." : "Your runs will show up here."}
        </p>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      <h2 className="text-h4 text-text-primary">Past runs</h2>
      {notice && <Callout tone="caution">{notice}</Callout>}
      {takes.map((t) => {
        const isOpen = open === t.id;
        return (
          <Card key={t.id} tone="sunken" padding="sm" className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : t.id)}
                className="flex flex-1 items-center gap-2 text-left text-body-sm text-text-body"
              >
                <Icon name={isOpen ? "chevron-down" : "chevron-right"} size={14} />
                <span className="font-medium text-text-primary">
                  {new Date(t.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
                <span className="text-text-muted">· {formatDuration(t.durationSec)}</span>
                {t.effective && <span className="text-text-muted">· Effective {Math.round(t.effective.score)}</span>}
                {t.talkTitle && <span className="truncate text-text-muted">· {t.talkTitle}</span>}
              </button>
              {confirming !== t.id && (
                <IconButton icon="trash-2" label="Delete this run" onClick={() => setConfirming(t.id)} />
              )}
            </div>
            {confirming === t.id && (
              <div className="flex flex-wrap items-center gap-2 text-body-sm text-text-body">
                <span>Delete this run and its feedback?</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setConfirming(null);
                    onDelete(t.id);
                  }}
                >
                  Delete
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                  Cancel
                </Button>
              </div>
            )}
            {isOpen && <PresentationFeedbackSections feedback={t.feedback} />}
          </Card>
        );
      })}
    </div>
  );
}
