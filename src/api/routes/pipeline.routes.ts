import { type Express, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  createPipeline,
  getAllPipelines,
  getPipelineById,
  addSubscriber,
  updatePipeline,
  updatePipelineActions,
  getPipelineHealth,
  deletePipeline,
  getSubscribersByPipelineId,
} from '../controllers/pipeline.controller.js';
import { createWebhook, getWebhooksByPipelineId } from '../controllers/webhook.controller.js';
import { logger } from '../../shared/logger.js';

// Validation schemas
const createPipelineSchema = z.object({
  name: z.string().min(1, 'Pipeline name is required').max(255),
  description: z.string().optional(),
  actionType: z.enum(['CONVERTER', 'EMAIL', 'DISCORD', 'PDF', 'AI_SUMMARIZER'], {
    errorMap: () => ({ message: 'Invalid actionType' }),
  }),
  config: z.record(z.unknown()).optional(),
});

const updatePipelineSchema = createPipelineSchema.partial();

const updatePipelineActionsSchema = z.object({
  enabledActions: z
    .array(z.enum(['CONVERTER', 'EMAIL', 'DISCORD', 'PDF', 'AI_SUMMARIZER']))
    .optional(),
  emailEnabled: z.boolean().optional(),
  discordEnabled: z.boolean().optional(),
});

const addSubscriberSchema = z.object({
  targetUrl: z.string().url('targetUrl must be a valid URL'),
});

const createWebhookSchema = z.object({
  eventType: z.string().min(1, 'eventType is required'),
  url: z.string().url('url must be a valid URL'),
});

type CreatePipelineRequest = z.infer<typeof createPipelineSchema>;
type UpdatePipelineRequest = z.infer<typeof updatePipelineSchema>;
type AddSubscriberRequest = z.infer<typeof addSubscriberSchema>;
type CreateWebhookRequest = z.infer<typeof createWebhookSchema>;
type UpdatePipelineActionsRequest = z.infer<typeof updatePipelineActionsSchema>;

export function setupPipelineRoutes(app: Express): void {
  /**
   * POST /api/pipelines
   * Create a new pipeline
   */
  app.post('/api/pipelines', async (req: Request, res: Response): Promise<void> => {
    try {
      const data: CreatePipelineRequest = createPipelineSchema.parse(req.body);

      const pipeline = await createPipeline({
        name: data.name,
        description: data.description,
        actionType: data.actionType,
        config: data.config as any,
      });

      logger.info('Pipeline endpoint: New pipeline created', {
        pipeline_id: pipeline.id,
      });

      res.status(201).json({
        success: true,
        message: 'Pipeline created successfully',
        data: pipeline,
      });
    } catch (error) {
      logger.error('POST /api/pipelines failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      } else if (error instanceof Error && error.message.includes('Unique constraint failed')) {
        res.status(409).json({
          success: false,
          message: 'Pipeline with this name already exists',
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
   * GET /api/pipelines
   * List all pipelines with their subscribers
   */
  app.get('/api/pipelines', async (_req: Request, res: Response): Promise<void> => {
    try {
      const pipelines = await getAllPipelines();

      logger.debug('GET /api/pipelines - Retrieved all pipelines', {
        count: pipelines.length,
      });

      res.status(200).json({
        success: true,
        message: `Retrieved ${pipelines.length} pipeline(s)`,
        data: pipelines,
      });
    } catch (error) {
      logger.error('GET /api/pipelines failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  /**
   * GET /api/pipelines/:id
   * Get a specific pipeline by ID with subscribers
   */
  app.get('/api/pipelines/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const pipeline = await getPipelineById(id);

      if (!pipeline) {
        logger.warn('GET /api/pipelines/:id - Pipeline not found', {
          pipeline_id: id,
        });

        res.status(404).json({
          success: false,
          message: 'Pipeline not found',
        });
        return;
      }

      logger.debug('GET /api/pipelines/:id - Retrieved pipeline', {
        pipeline_id: id,
      });

      res.status(200).json({
        success: true,
        message: 'Pipeline retrieved successfully',
        data: pipeline,
      });
    } catch (error) {
      logger.error('GET /api/pipelines/:id failed', {
        error: error instanceof Error ? error.message : String(error),
        pipeline_id: req.params.id,
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  /**
   * GET /api/pipelines/:id/health
   * Readiness checks for notification and AI dependencies
   */
  app.get('/api/pipelines/:id/health', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const report = await getPipelineHealth(id);

      if (!report) {
        res.status(404).json({
          success: false,
          message: 'Pipeline not found',
        });
        return;
      }

      const hasFailure = report.checks.some((check) => check.status === 'failed');

      res.status(hasFailure ? 503 : 200).json({
        success: true,
        message: hasFailure
          ? 'Pipeline readiness report contains failing checks'
          : 'Pipeline readiness checks passed',
        data: report,
      });
    } catch (error) {
      logger.error('GET /api/pipelines/:id/health failed', {
        error: error instanceof Error ? error.message : String(error),
        pipeline_id: req.params.id,
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  /**
   * PUT /api/pipelines/:id
   * Update a pipeline
   */
  app.put('/api/pipelines/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const data: UpdatePipelineRequest = updatePipelineSchema.parse(req.body);

      const pipeline = await updatePipeline(id, {
        name: data.name,
        description: data.description,
        actionType: data.actionType,
        config: data.config as any,
      });

      logger.info('PUT /api/pipelines/:id - Pipeline updated', {
        pipeline_id: id,
      });

      res.status(200).json({
        success: true,
        message: 'Pipeline updated successfully',
        data: pipeline,
      });
    } catch (error) {
      logger.error('PUT /api/pipelines/:id failed', {
        error: error instanceof Error ? error.message : String(error),
        pipeline_id: req.params.id,
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: 'Pipeline not found',
        });
      } else if (error instanceof Error && error.message.includes('Unique constraint failed')) {
        res.status(409).json({
          success: false,
          message: 'Pipeline with this name already exists',
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
   * PATCH /api/pipelines/:id
   * Partial update for dashboard toggles/config
   */
  app.patch('/api/pipelines/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const data: UpdatePipelineRequest = updatePipelineSchema.parse(req.body);

      const pipeline = await updatePipeline(id, {
        name: data.name,
        description: data.description,
        actionType: data.actionType,
        config: data.config as any,
      });

      logger.info('PATCH /api/pipelines/:id - Pipeline updated', {
        pipeline_id: id,
      });

      res.status(200).json({
        success: true,
        message: 'Pipeline updated successfully',
        data: pipeline,
      });
    } catch (error) {
      logger.error('PATCH /api/pipelines/:id failed', {
        error: error instanceof Error ? error.message : String(error),
        pipeline_id: req.params.id,
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: 'Pipeline not found',
        });
      } else if (error instanceof Error && error.message.includes('Unique constraint failed')) {
        res.status(409).json({
          success: false,
          message: 'Pipeline with this name already exists',
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
   * PATCH /api/pipelines/:id/actions
   * Dedicated endpoint for action toggles/flags
   */
  app.patch('/api/pipelines/:id/actions', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const data: UpdatePipelineActionsRequest = updatePipelineActionsSchema.parse(req.body);

      const pipeline = await updatePipelineActions(id, {
        enabledActions: data.enabledActions,
        emailEnabled: data.emailEnabled,
        discordEnabled: data.discordEnabled,
      });

      res.status(200).json({
        success: true,
        message: 'Pipeline actions updated successfully',
        data: pipeline,
      });
    } catch (error) {
      logger.error('PATCH /api/pipelines/:id/actions failed', {
        error: error instanceof Error ? error.message : String(error),
        pipeline_id: req.params.id,
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: 'Pipeline not found',
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
   * DELETE /api/pipelines/:id
   * Delete a pipeline
   */
  app.delete('/api/pipelines/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      await deletePipeline(id);

      logger.info('DELETE /api/pipelines/:id - Pipeline deleted', {
        pipeline_id: id,
      });

      res.status(200).json({
        success: true,
        message: 'Pipeline deleted successfully',
      });
    } catch (error) {
      logger.error('DELETE /api/pipelines/:id failed', {
        error: error instanceof Error ? error.message : String(error),
        pipeline_id: req.params.id,
      });

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: 'Pipeline not found',
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
   * GET /api/pipelines/:id/subscribers
   * Get all subscribers for a pipeline
   */
  app.get(
    '/api/pipelines/:id/subscribers',
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { id } = req.params;

        // Verify pipeline exists
        const pipeline = await getPipelineById(id);
        if (!pipeline) {
          logger.warn('GET /api/pipelines/:id/subscribers - Pipeline not found', {
            pipeline_id: id,
          });

          res.status(404).json({
            success: false,
            message: 'Pipeline not found',
          });
          return;
        }

        const subscribers = await getSubscribersByPipelineId(id);

        logger.debug('GET /api/pipelines/:id/subscribers - Retrieved subscribers', {
          pipeline_id: id,
          count: subscribers.length,
        });

        res.status(200).json({
          success: true,
          message: `Retrieved ${subscribers.length} subscriber(s)`,
          data: subscribers,
        });
      } catch (error) {
        logger.error('GET /api/pipelines/:id/subscribers failed', {
          error: error instanceof Error ? error.message : String(error),
          pipeline_id: req.params.id,
        });

        res.status(500).json({
          success: false,
          message: 'Internal server error',
        });
      }
    }
  );

  /**
   * POST /api/pipelines/:id/subscribers
   * Add a subscriber to a pipeline
   */
  app.post(
    '/api/pipelines/:id/subscribers',
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { id } = req.params;
        const data: AddSubscriberRequest = addSubscriberSchema.parse(req.body);

        const subscriber = await addSubscriber(id, {
          targetUrl: data.targetUrl,
        });

        logger.info('POST /api/pipelines/:id/subscribers - Subscriber added', {
          pipeline_id: id,
          subscriber_id: subscriber.id,
        });

        res.status(201).json({
          success: true,
          message: 'Subscriber added successfully',
          data: subscriber,
        });
      } catch (error) {
        logger.error('POST /api/pipelines/:id/subscribers failed', {
          error: error instanceof Error ? error.message : String(error),
          pipeline_id: req.params.id,
        });

        if (error instanceof z.ZodError) {
          res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: error.errors,
          });
        } else if (error instanceof Error && error.message.includes('not found')) {
          res.status(404).json({
            success: false,
            message: 'Pipeline not found',
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Internal server error',
          });
        }
      }
    }
  );

  /**
   * GET /api/pipelines/:id/webhooks
   * Get all webhooks for a pipeline
   */
  app.get(
    '/api/pipelines/:id/webhooks',
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { id } = req.params;

        const webhooks = await getWebhooksByPipelineId(id);

        logger.debug('GET /api/pipelines/:id/webhooks - Retrieved webhooks', {
          pipeline_id: id,
          count: webhooks.length,
        });

        res.status(200).json({
          success: true,
          message: `Retrieved ${webhooks.length} webhook(s)`,
          data: webhooks,
        });
      } catch (error) {
        logger.error('GET /api/pipelines/:id/webhooks failed', {
          error: error instanceof Error ? error.message : String(error),
          pipeline_id: req.params.id,
        });

        res.status(500).json({
          success: false,
          message: 'Internal server error',
        });
      }
    }
  );

  /**
   * POST /api/pipelines/:id/webhooks
   * Create a webhook for a pipeline
   */
  app.post(
    '/api/pipelines/:id/webhooks',
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { id } = req.params;
        const data: CreateWebhookRequest = createWebhookSchema.parse(req.body);

        const webhook = await createWebhook(id, {
          eventType: data.eventType,
          url: data.url,
        });

        logger.info('POST /api/pipelines/:id/webhooks - Webhook created', {
          webhook_id: webhook.id,
          pipeline_id: id,
        });

        res.status(201).json({
          success: true,
          message: 'Webhook created successfully',
          data: webhook,
        });
      } catch (error) {
        logger.error('POST /api/pipelines/:id/webhooks failed', {
          error: error instanceof Error ? error.message : String(error),
          pipeline_id: req.params.id,
        });

        if (error instanceof z.ZodError) {
          res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: error.errors,
          });
        } else if (error instanceof Error && error.message.includes('not found')) {
          res.status(404).json({
            success: false,
            message: 'Pipeline not found',
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Internal server error',
          });
        }
      }
    }
  );

}
