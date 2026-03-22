-- CreateTable
CREATE TABLE "delivery_logs" (
  "id" TEXT NOT NULL,
  "subscriberId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "responseBody" TEXT,
  "durationMs" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_logs_subscriberId_idx" ON "delivery_logs"("subscriberId");

-- CreateIndex
CREATE INDEX "delivery_logs_taskId_idx" ON "delivery_logs"("taskId");

-- CreateIndex
CREATE INDEX "delivery_logs_createdAt_idx" ON "delivery_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "delivery_logs"
  ADD CONSTRAINT "delivery_logs_subscriberId_fkey"
  FOREIGN KEY ("subscriberId") REFERENCES "subscribers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_logs"
  ADD CONSTRAINT "delivery_logs_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
