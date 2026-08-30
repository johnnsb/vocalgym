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
