-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN IF NOT EXISTS "reminderEmailsEnabled" BOOLEAN NOT NULL DEFAULT true;
