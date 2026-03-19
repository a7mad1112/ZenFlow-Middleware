-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('CONVERTER', 'EMAIL', 'DISCORD', 'PDF', 'AI_SUMMARIZER');

-- AlterTable
ALTER TABLE "pipelines" ADD COLUMN     "actionType" "ActionType" NOT NULL DEFAULT 'CONVERTER',
ADD COLUMN     "config" JSONB;

-- CreateTable
CREATE TABLE "subscribers" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscribers_pipelineId_idx" ON "subscribers"("pipelineId");

-- AddForeignKey
ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
