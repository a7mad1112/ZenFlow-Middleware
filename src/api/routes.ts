import { type Express, type Request, type Response } from 'express';
import { z } from 'zod';
import { logger } from '../shared/logger.js';
import type { WebhookPayload } from '../models/types.js';

const webhookPayloadSchema = z.object({
  id: z.string().uuid(),
  eventType: z.string().min(1),
  data: z.record(z.unknown()),
  userId: z.string().optional(),
});

export function setupRoutes(app: Express): void {
  /**
   * POST /webhooks
   * Ingests webhook events and enqueues them for processing
   */
  app.post('/webhooks', (req: Request, res: Response): void => {
    try {
      const payload = webhookPayloadSchema.parse(req.body);

      const webhook: WebhookPayload = {
        ...payload,
        timestamp: new Date(),
      };

      logger.info('Webhook ingested', {
        webhook_id: webhook.id,
        event_type: webhook.eventType,
      });

      // TODO: Enqueue task with pg-boss
      res.status(202).json({
        success: true,
        message: 'Webhook accepted for processing',
        webhook_id: webhook.id,
      });
    } catch (error) {
      logger.error('Failed to ingest webhook', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Invalid webhook payload',
          errors: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Internal server error',
        });
      }
    }
  });

  /**
   * GET /tasks/:id
   * Retrieves task status and details
   */
  app.get('/tasks/:id', (req: Request, res: Response): void => {
    const { id } = req.params;

    logger.debug('Fetching task details', { task_id: id });

    // TODO: Fetch task from database
    res.status(200).json({
      success: true,
      message: 'Task details retrieved',
      task_id: id,
    });
  });
}
