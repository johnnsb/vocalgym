import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { ensureSession } from "./session";
import { normalizePresentationPrep, normalizeTakeInput } from "./presentationPrep";
import type { PresentationPrep, PresentationTake } from "./types";

// Server data layer for presentation mode. Everything is normalized
// (lib/presentationPrep.ts) on the way in; takes are session-scoped.

const MAX_TAKES = 50;

type TakeRow = Prisma.PresentationTakeGetPayload<object>;

function rowToTake(r: TakeRow): PresentationTake {
  return {
    id: r.id,
    createdAt: r.createdAt.getTime(),
    talkTitle: r.talkTitle,
    durationSec: r.durationSec,
    transcript: r.transcript,
    feedback: r.feedback,
    effective: (r.effective ?? null) as PresentationTake["effective"],
    nonverbal: (r.nonverbal ?? null) as PresentationTake["nonverbal"],
    slideTimings: (r.slideTimings ?? null) as PresentationTake["slideTimings"],
  };
}

const json = (v: unknown) =>
  v === null || v === undefined ? Prisma.DbNull : (v as Prisma.InputJsonValue);

export async function getPresentationPrep(sessionId: string): Promise<PresentationPrep> {
  const row = await prisma.presentationPrep.findUnique({ where: { sessionId } });
  return normalizePresentationPrep(row?.prep ?? null);
}

export async function savePresentationPrep(
  sessionId: string,
  input: unknown,
): Promise<PresentationPrep> {
  const prep = normalizePresentationPrep(input);
  await ensureSession(sessionId);
  const data = { prep: prep as unknown as Prisma.InputJsonValue };
  await prisma.presentationPrep.upsert({
    where: { sessionId },
    create: { sessionId, ...data },
    update: data,
  });
  return prep;
}

export async function listTakes(sessionId: string): Promise<PresentationTake[]> {
  const rows = await prisma.presentationTake.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: MAX_TAKES,
  });
  return rows.map(rowToTake);
}

export async function addTake(sessionId: string, input: unknown): Promise<PresentationTake> {
  const take = normalizeTakeInput(input);
  if (!take) throw new Error("invalid take");
  await ensureSession(sessionId);
  const row = await prisma.presentationTake.create({
    data: {
      sessionId,
      talkTitle: take.talkTitle,
      durationSec: take.durationSec,
      transcript: take.transcript,
      feedback: take.feedback,
      effective: json(take.effective),
      nonverbal: json(take.nonverbal),
      slideTimings: json(take.slideTimings),
    },
  });
  const stale = await prisma.presentationTake.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    skip: MAX_TAKES,
    select: { id: true },
  });
  if (stale.length) {
    await prisma.presentationTake.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }
  return rowToTake(row);
}

export async function removeTake(sessionId: string, id: string): Promise<void> {
  await prisma.presentationTake.deleteMany({ where: { id, sessionId } });
}
