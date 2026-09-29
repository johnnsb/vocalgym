import type { ReactNode } from "react";
import { Icon } from "@/components/ui";

// Renderer for interview feedback (INTERVIEW_FEEDBACK_SYSTEM_PROMPT). A
// standalone copy of QAFeedbackSections' approach, not a shared component —
// different section set, and "### question" subheadings inside "Question by
// question". Section names are anchored (^) so a question subheading that
// happens to contain "next round" or "overall" is never mistaken for a section.
const SECTIONS: { test: RegExp; title: string; icon: string; emphasis?: boolean }[] = [
  { test: /^overall\b/i, title: "Overall", icon: "message-square" },
  { test: /^question[\s-]+by[\s-]+question\b/i, title: "Question by question", icon: "layout-list" },
  { test: /^key\s+points\b/i, title: "Key points", icon: "check" },
  { test: /^reading\s+the\s+panel\b/i, title: "Reading the panel", icon: "search" },
  { test: /^(?:for\s+your\s+)?next\s+round\b/i, title: "For your next round", icon: "arrow-right", emphasis: true },
];

interface ParsedSection {
  title: string;
  icon: string;
  emphasis: boolean;
  lines: string[];
}

// Section headers: bold ("**Overall** — …") or level-1/2 ATX ("## Overall").
// Level-3+ ("### …") are question subheadings, handled in renderBody.
const BOLD_HEADER_RE = /^\s*(?:[-*]\s+)?\*\*(.+?)\*\*\s*(?:[:：]|[—–-])?\s*(.*)$/;
const HASH_HEADER_RE = /^\s*#{1,2}\s+\**(.+?)\**\s*:?\s*$/;
const SUBHEAD_RE = /^\s*#{3,6}\s+\**(.+?)\**\s*$/;

function parse(md: string): ParsedSection[] {
  const out: ParsedSection[] = [];
  let current: ParsedSection | null = null;
  for (const line of md.replace(/\r\n/g, "\n").split("\n")) {
    const hash = line.match(HASH_HEADER_RE);
    const bold = hash ? null : line.match(BOLD_HEADER_RE);
    const name = hash ? hash[1] : bold ? bold[1] : null;
    const meta = name ? SECTIONS.find((s) => s.test.test(name.trim())) : undefined;
    if (name && meta) {
      if (current) out.push(current);
      current = { title: meta.title, icon: meta.icon, emphasis: Boolean(meta.emphasis), lines: [] };
      const rest = bold?.[2]?.trim();
      if (rest) current.lines.push(rest);
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) out.push(current);
  return out;
}

function renderInline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, i) => {
      const bold = part.match(/^\*\*([^*]+)\*\*$/);
      return bold ? (
        <strong key={i} className="font-semibold text-text-primary">
          {bold[1]}
        </strong>
      ) : (
        <span key={i}>{part}</span>
      );
    });
}

function renderBody(lines: string[]): ReactNode[] {
  const blocks: ReactNode[] = [];
  let items: string[] | null = null;
  const flush = () => {
    if (!items) return;
    blocks.push(
      <ul
        key={blocks.length}
        className="list-disc space-y-1 pl-5 text-body-sm leading-relaxed text-text-body marker:text-text-muted"
      >
        {items.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    items = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const sub = line.match(SUBHEAD_RE);
    if (sub) {
      flush();
      blocks.push(
        <p key={blocks.length} className="pt-2 text-body-sm font-semibold text-text-primary">
          {sub[1]}
        </p>,
      );
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      items ??= [];
      items.push(bullet[1]);
    } else {
      flush();
      blocks.push(
        <p key={blocks.length} className="text-body-sm leading-relaxed text-text-body">
          {renderInline(line)}
        </p>,
      );
    }
  }
  flush();
  return blocks;
}

export default function InterviewFeedbackSections({ feedback }: { feedback: string }) {
  const sections = parse(feedback);
  if (sections.length < 2) {
    return (
      <div className="whitespace-pre-wrap text-body-sm leading-relaxed text-text-primary">
        {feedback}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {sections.map((section, i) => (
        <div
          key={i}
          className={`border-l-2 border-ember pl-4 ${
            section.emphasis ? "rounded-r-md bg-surface-accent-tint py-3 pr-4" : ""
          }`}
        >
          <div className="mb-1 flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-text-accent">
            <Icon name={section.icon} size={13} />
            {section.title}
          </div>
          <div className="space-y-2">{renderBody(section.lines)}</div>
        </div>
      ))}
    </div>
  );
}
