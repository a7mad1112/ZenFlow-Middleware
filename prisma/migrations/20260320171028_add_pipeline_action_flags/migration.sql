-- AlterTable
ALTER TABLE "pipelines" ADD COLUMN     "discordEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "enabledActions" TEXT[] DEFAULT ARRAY['DISCORD', 'EMAIL']::TEXT[];
