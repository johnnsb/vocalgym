// Dead-simple structured console logging for the API routes. One short id per
// request ties its lines together in the output.

export function newRequestId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function logInfo(scope: string, id: string, msg: string, extra?: unknown) {
  if (extra === undefined) console.log(`[${scope} ${id}] ${msg}`);
  else console.log(`[${scope} ${id}] ${msg}`, extra);
}

export function logError(
  scope: string,
  id: string,
  msg: string,
  extra?: unknown,
) {
  if (extra === undefined) console.error(`[${scope} ${id}] ${msg}`);
  else console.error(`[${scope} ${id}] ${msg}`, extra);
}

const MAX_SUMMARY = 300;

/** One readable log line for any thrown value. Prisma errors start with a
 *  newline and an "Invalid `prisma.x()` invocation:" preamble, which made
 *  "GET failed: " look blank in the dev log — this keeps the error code and
 *  the actual cause on the same line. */
export function errorSummary(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const code = (err as { code?: unknown }).code;
  const text = err.message
    .replace(/Invalid `[^`]*` invocation:/, "")
    .replace(/\s+/g, " ")
    .trim();
  const line = [typeof code === "string" ? code : "", text || err.name]
    .filter(Boolean)
    .join(" ");
  return line.length > MAX_SUMMARY ? `${line.slice(0, MAX_SUMMARY - 1)}…` : line;
}
