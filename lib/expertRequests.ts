import { promises as fs } from "fs";
import path from "path";

// File-backed store for "get expert help" requests. No real backend yet — a
// human (you) fulfils these by reading /admin/requests. Same durability caveat
// as lib/usageCounter.ts: fine for local / long-running hosts, not for Vercel's
// ephemeral serverless filesystem.

const FILE =
  process.env.EXPERT_REQUESTS_FILE ||
  path.join(process.cwd(), ".vocalgym-expert-requests.json");

const MAX_KEPT = 500;

export interface ExpertRequest {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  situation: string;
}

export interface ExpertRequestInput {
  name: string;
  email: string;
  situation: string;
}

async function readAll(): Promise<ExpertRequest[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(FILE, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as ExpertRequest[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(list: ExpertRequest[]): Promise<void> {
  try {
    await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
  } catch {
    // read-only FS — the request just isn't persisted; never fail over it.
  }
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveExpertRequest(
  input: ExpertRequestInput,
): Promise<ExpertRequest> {
  const record: ExpertRequest = {
    id: newId(),
    createdAt: new Date().toISOString(),
    name: input.name,
    email: input.email,
    situation: input.situation,
  };
  const list = await readAll();
  list.push(record);
  await writeAll(list.slice(-MAX_KEPT));
  return record;
}

/** Newest first. */
export async function loadExpertRequests(): Promise<ExpertRequest[]> {
  return (await readAll()).slice().reverse();
}

export function expertRequestsFilePath(): string {
  return FILE;
}
