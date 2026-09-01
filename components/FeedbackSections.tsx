import type { ReactNode } from "react";
import { Icon } from "@/components/ui";

// Design-system: one accent, no feature colors. Sections differentiate by icon
// + label, not hue — every rail is the Ember line.
const SECTIONS: { test: RegExp; title: string; icon: string; emphasis?: boolean }[] = [
  { test: /overall/i, title: "Overall", icon: "message-square" },
  {
    test: /(what landed|landed|strengths|worked well)/i,
    title: "What landed",
    icon: "check",
  },
  { test: /gap/i, title: "Gaps vs. the script", icon: "alert-circle" },
  { test: /delivery/i, title: "Delivery", icon: "activity" },
  {
    test: /(nonverbal|non-verbal|body language|on camera)/i,
    title: "Nonverbal",
    icon: "video",
  },
  {
    test: /(next take|next time|for your next|going forward)/i,
    title: "For your next take",
    icon: "arrow-right",
    emphasis: true,
  },
];

interface ParsedSection {
  title: string;
  icon: string;
  emphasis: boolean;
  lines: string[];
}

// Section headers arrive either bold ("**Overall** — ...") or as an ATX
// heading ("## Overall"); accept both.
const BOLD_HEADER_RE = /^\s*(?:[-*]\s+)?\*\*(.+?)\*\*\s*(?:[:：]|[—–-])?\s*(.*)$/;
const HASH_HEADER_RE = /^\s*#{1,6}\s+\**(.+?)\**\s*:?\s*$/;

function parse(md: string): ParsedSection[] {
  const rawLines = md.replace(/\r\n/g, "\n").split("\n");
  const out: ParsedSection[] = [];
  let current: ParsedSection | null = null;

  for (const line of rawLines) {
    const hash = line.match(HASH_HEADER_RE);
    const bold = hash ? null : line.match(BOLD_HEADER_RE);
    const name = hash ? hash[1] : bold ? bold[1] : null;
    const meta = name
      ? SECTIONS.find((section) => section.test.test(name))
      : undefined;

    if (name && meta) {
      if (current) out.push(current);
      current = {
        title: meta.title,
        icon: meta.icon,
        emphasis: Boolean(meta.emphasis),
        lines: [],
      };
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

function renderBody(lines: string[], compact: boolean): ReactNode[] {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const textSize = compact ? "text-caption" : "text-body-sm";

  const flush = () => {
    if (!list) return;
    const items = list.items;
    if (list.ordered) {
      blocks.push(
        <ol
          key={blocks.length}
          className={`list-decimal space-y-1 pl-5 ${textSize} leading-relaxed text-text-body marker:text-text-muted`}
        >
          {items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>,
      );
    } else {
      blocks.push(
        <ul
          key={blocks.length}
          className={`list-disc space-y-1 pl-5 ${textSize} leading-relaxed text-text-body marker:text-text-muted`}
        >
          {items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
    }
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet) {
      if (list?.ordered) flush();
      list ??= { ordered: false, items: [] };
      list.items.push(bullet[1]);
    } else if (numbered) {
      if (list && !list.ordered) flush();
      list ??= { ordered: true, items: [] };
      list.items.push(numbered[1]);
    } else {
      flush();
      blocks.push(
        <p
          key={blocks.length}
          className={`${textSize} leading-relaxed text-text-body`}
        >
          {renderInline(line)}
        </p>,
      );
    }
  }
  flush();
  return blocks;
}

interface Props {
  feedback: string;
  compact?: boolean;
}

export default function FeedbackSections({ feedback, compact = false }: Props) {
  const sections = parse(feedback);

  if (sections.length < 2) {
    return (
      <div
        className={`whitespace-pre-wrap leading-relaxed text-text-primary ${
          compact ? "text-caption" : "text-body-sm"
        }`}
      >
        {feedback}
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {sections.map((section, i) => (
        <div
          key={i}
          className={`border-l-2 border-ember ${compact ? "pl-3" : "pl-4"} ${
            section.emphasis && !compact
              ? "rounded-r-md bg-surface-accent-tint py-3 pr-4"
              : ""
          }`}
        >
          <div className="mb-1 flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-text-accent">
            <Icon name={section.icon} size={13} />
            {section.title}
          </div>
          <div className={compact ? "space-y-1.5" : "space-y-2"}>
            {renderBody(section.lines, compact)}
          </div>
        </div>
      ))}
    </div>
  );
}
