/*
  Warnings:

  - Added the required column `authTag` to the `webhooks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `encryptedValue` to the `webhooks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `iv` to the `webhooks` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "webhooks" ADD COLUMN     "authTag" TEXT NOT NULL,
ADD COLUMN     "encryptedValue" TEXT NOT NULL,
ADD COLUMN     "iv" TEXT NOT NULL;
