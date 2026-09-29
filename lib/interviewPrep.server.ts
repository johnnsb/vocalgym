import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { ensureSession } from "./session";
import { normalizePrep } from "./interviewPrep";
import type { InterviewPrepState } from "./types";

// Server data layer for interview prep (app/prep/interview). One row per
// session; everything is normalized (lib/interviewPrep.ts) on the way in and
// out, so a hand-crafted request can't store oversized or malformed blobs.

export async function getPrep(sessionId: string): Promise<InterviewPrepState> {
  const row = await prisma.interviewPrep.findUnique({ where: { sessionId } });
  return normalizePrep(row ? { panel: row.panel, candidate: row.candidate } : null);
}

export async function savePrep(
  sessionId: string,
  input: unknown,
): Promise<InterviewPrepState> {
  const state = normalizePrep(input);
  await ensureSession(sessionId);
  const data = {
    panel: state.panel as unknown as Prisma.InputJsonValue,
    candidate: state.candidate as unknown as Prisma.InputJsonValue,
  };
  await prisma.interviewPrep.upsert({
    where: { sessionId },
    create: { sessionId, ...data },
    update: data,
  });
  return state;
}
