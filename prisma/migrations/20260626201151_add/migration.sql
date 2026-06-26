/*
  Warnings:

  - Added the required column `requireApproval` to the `environments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "environments" ADD COLUMN     "requireApproval" BOOLEAN NOT NULL;
