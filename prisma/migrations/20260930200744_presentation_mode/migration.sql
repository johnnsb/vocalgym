-- CreateTable
CREATE TABLE "PresentationPrep" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "prep" JSONB NOT NULL,

    CONSTRAINT "PresentationPrep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresentationTake" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "talkTitle" TEXT NOT NULL DEFAULT '',
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "transcript" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "effective" JSONB,
    "nonverbal" JSONB,
    "slideTimings" JSONB,

    CONSTRAINT "PresentationTake_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PresentationPrep_sessionId_key" ON "PresentationPrep"("sessionId");

-- CreateIndex
CREATE INDEX "PresentationTake_sessionId_createdAt_idx" ON "PresentationTake"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "PresentationPrep" ADD CONSTRAINT "PresentationPrep_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresentationTake" ADD CONSTRAINT "PresentationTake_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
