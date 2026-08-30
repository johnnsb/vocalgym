-- AlterTable
ALTER TABLE "Attempt" ADD COLUMN     "scriptId" TEXT,
ADD COLUMN     "scriptLabel" TEXT;

-- CreateIndex
CREATE INDEX "Attempt_scriptId_idx" ON "Attempt"("scriptId");
