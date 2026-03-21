-- CreateIndex
CREATE INDEX "webhooks_pipelineId_eventType_isActive_idx" ON "webhooks"("pipelineId", "eventType", "isActive");
