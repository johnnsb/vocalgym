import type { ReactNode } from "react";

interface Accent {
  border: string;
  label: string;
  icon: ReactNode;
}

const CHECK = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.29a1 1 0 00-1.4-1.42L9 10.58 7.7 9.3a1 1 0 00-1.4 1.4l2 2a1 1 0 001.4 0l4.99-5z"
      clipRule="evenodd"
    />
  </svg>
);

const INFO = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
    <path
      fillRule="evenodd"
      d="M18 10A8 8 0 112 10a8 8 0 0116 0zm-8-4a1 1 0 100 2 1 1 0 000-2zm-1 4a1 1 0 112 0v4a1 1 0 11-2 0v-4z"
      clipRule="evenodd"
    />
  </svg>
);

const ALERT = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
    <path
      fillRule="evenodd"
      d="M8.49 2.94c.64-1.15 2.38-1.15 3.02 0l6.28 11.25c.63 1.13-.18 2.56-1.5 2.56H3.71c-1.32 0-2.13-1.43-1.5-2.56L8.49 2.94zM10 6a1 1 0 00-1 1v3a1 1 0 002 0V7a1 1 0 00-1-1zm0 8a1 1 0 100-2 1 1 0 000 2z"
      clipRule="evenodd"
    />
  </svg>
);

const SOUND = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
    <path d="M10 3.75a.75.75 0 00-1.26-.55L5.6 6H3.75A1.75 1.75 0 002 7.75v4.5c0 .97.78 1.75 1.75 1.75H5.6l3.14 2.8A.75.75 0 0010 16.25V3.75z" />
    <path d="M13.53 7.2a.75.75 0 011.05.15 4.5 4.5 0 010 5.3.75.75 0 11-1.2-.9 3 3 0 000-3.5.75.75 0 01.15-1.05z" />
  </svg>
);

const ARROW = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.7 6.3a1 1 0 000 1.4L10.58 9H6a1 1 0 100 2h4.59l-1.9 1.3a1 1 0 101.42 1.4l3-3a1 1 0 000-1.4l-3-3a1 1 0 00-1.42 0z"
      clipRule="evenodd"
    />
  </svg>
);

const CAMERA = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
    <path d="M1 6.75A2.75 2.75 0 013.75 4h8.5A2.75 2.75 0 0115 6.75v6.5A2.75 2.75 0 0112.25 16h-8.5A2.75 2.75 0 011 13.25v-6.5z" />
    <path d="M16.5 8.06a1 1 0 011.5.87v2.14a1 1 0 01-1.5.87L15 11.2V8.8l1.5-.74z" />
  </svg>
);

const SECTIONS: { test: RegExp; title: string; accent: Accent }[] = [
  {
    test: /overall/i,
    title: "Overall",
    accent: { border: "border-slate-300", label: "text-slate-500", icon: INFO },
  },
  {
    test: /(what landed|landed|strengths|worked well)/i,
    title: "What landed",
    accent: {
      border: "border-emerald-400",
      label: "text-emerald-600",
      icon: CHECK,
    },
  },
  {
    test: /gap/i,
    title: "Gaps vs. the script",
    accent: { border: "border-amber-400", label: "text-amber-600", icon: ALERT },
  },
  {
    test: /delivery/i,
    title: "Delivery",
    accent: { border: "border-sky-400", label: "text-sky-600", icon: SOUND },
  },
  {
    test: /(nonverbal|non-verbal|body language|on camera)/i,
    title: "Nonverbal",
    accent: {
      border: "border-fuchsia-400",
      label: "text-fuchsia-600",
      icon: CAMERA,
    },
  },
  {
    test: /(next take|next time|for your next|going forward)/i,
    title: "For your next take",
    accent: {
      border: "border-violet-400",
      label: "text-violet-600",
      icon: ARROW,
    },
  },
];

interface ParsedSection {
  title: string;
  accent: Accent | null;
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
      current = { title: meta.title, accent: meta.accent, lines: [] };
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
        <strong key={i} className="font-semibold text-slate-900">
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
  const textSize = compact ? "text-xs" : "text-sm";

  const flush = () => {
    if (!list) return;
    const items = list.items;
    if (list.ordered) {
      blocks.push(
        <ol
          key={blocks.length}
          className={`list-decimal space-y-1 pl-5 ${textSize} leading-relaxed text-slate-700 marker:text-slate-400`}
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
          className={`list-disc space-y-1 pl-5 ${textSize} leading-relaxed text-slate-700 marker:text-slate-400`}
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
          className={`${textSize} leading-relaxed text-slate-700`}
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
        className={`whitespace-pre-wrap leading-relaxed text-slate-800 ${
          compact ? "text-xs" : "text-sm"
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
          className={`border-l-2 ${section.accent?.border ?? "border-slate-200"} ${
            compact ? "pl-3" : "pl-4"
          }`}
        >
          <div
            className={`mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${
              section.accent?.label ?? "text-slate-500"
            }`}
          >
            {section.accent?.icon}
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
