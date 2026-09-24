-- AlterTable
ALTER TABLE "pipelines" ADD COLUMN     "lastRunId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "pipelines_lastRunId_key" ON "pipelines"("lastRunId");

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_lastRunId_fkey" FOREIGN KEY ("lastRunId") REFERENCES "pipeline_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: point every pipeline at its newest run by runNumber. Pipelines with no runs stay NULL (idle).
UPDATE "pipelines" AS p
SET "lastRunId" = latest."id"
FROM (
  SELECT DISTINCT ON ("pipelineId") "id", "pipelineId"
  FROM "pipeline_runs"
  ORDER BY "pipelineId", "runNumber" DESC
) AS latest
WHERE latest."pipelineId" = p."id";
