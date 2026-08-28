/*
  Warnings:

  - A unique constraint covering the columns `[pipelineId,runNumber]` on the table `pipeline_runs` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `runNumber` to the `pipeline_runs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "pipeline_runs" ADD COLUMN     "runNumber" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_runs_pipelineId_runNumber_key" ON "pipeline_runs"("pipelineId", "runNumber");
