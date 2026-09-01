"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card } from "@/components/ui";

interface Props {
  script: string;
  loading: boolean;
  /** Omitted for uploaded scripts — there's nothing to regenerate. */
  onRegenerate?: () => void;
}

export default function ScriptResult({ script, loading, onRegenerate }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-h4 text-text-primary">Your script</h2>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={copied ? "check" : "copy"}
            onClick={copy}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
          {onRegenerate && (
            <Button
              variant="secondary"
              size="sm"
              icon="rotate-ccw"
              onClick={onRegenerate}
              disabled={loading}
            >
              {loading ? "Regenerating…" : "Regenerate"}
            </Button>
          )}
        </div>
      </div>

      <div className="whitespace-pre-wrap text-body-sm leading-relaxed text-text-primary">
        {script}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
        <p className="text-body-sm text-text-muted">
          Ready to rehearse it out loud?
        </p>
        <Button as={Link} href="/practice" iconAfter="arrow-right">
          Practice this script
        </Button>
      </div>
    </Card>
  );
}
