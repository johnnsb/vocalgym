import { prisma } from "./prisma";

// "Get expert help" submissions. Backed by the ExpertRequest table (was a JSON
// file). A human fulfils these by reading /admin/requests.

export interface ExpertRequest {
  id: string;
  createdAt: string; // ISO
  name: string;
  email: string;
  situation: string;
}

export interface ExpertRequestInput {
  name: string;
  email: string;
  situation: string;
}

export async function saveExpertRequest(
  input: ExpertRequestInput,
): Promise<ExpertRequest> {
  const row = await prisma.expertRequest.create({
    data: {
      name: input.name,
      email: input.email,
      situation: input.situation,
    },
  });
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    name: row.name,
    email: row.email,
    situation: row.situation,
  };
}

/** Newest first. */
export async function loadExpertRequests(): Promise<ExpertRequest[]> {
  const rows = await prisma.expertRequest.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    name: r.name,
    email: r.email,
    situation: r.situation,
  }));
}

/** Human-readable description of where these are stored (for the admin page). */
export function expertRequestsLocation(): string {
  return "Postgres · ExpertRequest table";
}
