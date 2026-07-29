-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "settings" JSONB NOT NULL DEFAULT '{}';
