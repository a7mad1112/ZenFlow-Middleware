import { type Express, type Request, type Response } from 'express';
import { z } from 'zod';
import { ingestWebhook, getTaskStatus } from '../controllers/webhook.controller.js';
import { logger } from '../../shared/logger.js';
import { webhookIngestionRateLimiter } from '../../middleware/rate-limiter.js';

// Validate incoming webhook payload (accept any JSON)
const ingestWebhookSchema = z.object({
  payload: z.record(z.unknown()),
});

export function setupWebhookRoutes(app: Express): void {
  /**
   * @swagger
   * /webhooks/{pipelineId}:
   *   post:
   *     summary: Ingest webhook payload for a pipeline
   *     tags:
   *       - Webhooks
   *     parameters:
   *       - in: path
   *         name: pipelineId
   *         required: true
   *         schema:
   *           type: string
   *         description: Pipeline identifier
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             additionalProperties: true
   *           example:
   *             eventType: order.created
   *             orderId: ORD-1001
   *             customer:
   *               email: buyer@example.com
   *             total: 149.99
   *     responses:
   *       202:
   *         description: Webhook accepted for processing
   *       400:
   *         description: Invalid payload or routing mismatch
   *       429:
   *         description: Too many requests
   *       500:
   *         description: Internal server error
   */
  app.post(
    '/api/webhooks/:pipelineId',
    webhookIngestionRateLimiter,
    async (req: Request, res: Response): Promise<void> => {
      const { pipelineId } = req.params;

      try {
        // Validate incoming body
        const validatedData = ingestWebhookSchema.parse({
          payload: req.body,
        });

        logger.info('Webhook ingestion initiated', {
          webhookId: pipelineId,
          payloadSize: JSON.stringify(req.body).length,
        });

        // Ingest webhook and queue job
        const result = await ingestWebhook(pipelineId, validatedData);

        logger.info('Webhook ingested successfully', {
          webhookId: pipelineId,
          taskId: result.id,
          jobId: result.jobId,
        });

        // Return 202 Accepted with tracking logId
        res.status(202).json({
          success: true,
          message: 'Webhook accepted for processing',
          logId: result.id,
          jobId: result.jobId,
          status: 'pending',
          createdAt: result.createdAt,
        });
      } catch (error) {
        // Handle webhook not found (404)
        if (error instanceof Error && error.message.includes('not found')) {
          logger.warn('Webhook not found for ingestion', { webhookId: pipelineId });
          res.status(404).json({
            success: false,
            message: 'Webhook not found',
            webhookId: pipelineId,
          });
          return;
        }

        if (
          error instanceof Error &&
          (error.message.includes('event mismatch') ||
            error.message.includes('must include eventType') ||
            error.message.includes('No active webhook configuration found for event type'))
        ) {
          logger.warn('Webhook payload/event routing validation failed', {
            webhookId: pipelineId,
            error: error.message,
          });
          res.status(400).json({
            success: false,
            message: error.message,
            webhookId: pipelineId,
          });
          return;
        }

        // Handle inactive webhook (400)
        if (error instanceof Error && error.message.includes('inactive')) {
          logger.warn('Webhook is inactive', { webhookId: pipelineId });
          res.status(400).json({
            success: false,
            message: 'Webhook is inactive',
            webhookId: pipelineId,
          });
          return;
        }

        // Handle validation errors (400)
        if (error instanceof z.ZodError) {
          logger.warn('Webhook payload validation failed', {
            webhookId: pipelineId,
            errors: error.errors,
          });
          res.status(400).json({
            success: false,
            message: 'Invalid webhook payload',
            errors: error.errors,
          });
          return;
        }

        // Handle all other errors (500)
        logger.error('Failed to ingest webhook', {
          webhookId: pipelineId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        res.status(500).json({
          success: false,
          message: 'Internal server error',
          webhookId: pipelineId,
        });
      }
    }
  );

  /**
   * GET /api/webhooks/:webhookId/status/:logId
   * Retrieves the status of a webhook processing task
   *
   * @param webhookId - The webhook ID (for context)
   * @param logId - The task/log ID to check status
   * @returns Task details including status, attempts, result, error
   */
  app.get(
    '/api/webhooks/:webhookId/status/:logId',
    async (req: Request, res: Response): Promise<void> => {
      const { webhookId, logId } = req.params;

      try {
        logger.debug('Retrieving task status', {
          webhookId: webhookId,
          taskId: logId,
        });

        const task = await getTaskStatus(logId);

        // Verify the task belongs to the webhook
        if (task.webhookId !== webhookId) {
          logger.warn('Task does not belong to webhook', {
            webhookId: webhookId,
            taskId: logId,
            actualWebhookId: task.webhookId,
          });
          res.status(404).json({
            success: false,
            message: 'Task not found for this webhook',
          });
          return;
        }

        logger.debug('Task status retrieved successfully', {
          webhookId: webhookId,
          taskId: logId,
          status: task.status,
        });

        res.status(200).json({
          success: true,
          message: 'Task status retrieved',
          logId: task.id,
          webhookId: task.webhookId,
          pipelineId: task.pipelineId,
          status: task.status,
          attempts: task.attempts,
          maxAttempts: task.maxAttempts,
          payload: task.payload,
          result: task.result,
          error: task.error,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          completedAt: task.completedAt,
        });
      } catch (error) {
        // Handle task not found (404)
        if (error instanceof Error && error.message.includes('not found')) {
          logger.warn('Task not found', {
            webhookId: webhookId,
            logId: logId,
          });
          res.status(404).json({
            success: false,
            message: 'Task not found',
            logId: logId,
          });
          return;
        }

        // Handle all other errors (500)
        logger.error('Failed to retrieve task status', {
          webhookId: webhookId,
          logId: logId,
          error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
          success: false,
          message: 'Internal server error',
          logId: logId,
        });
      }
    }
  );
}
