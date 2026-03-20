import { type Express, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  getDashboardLogDetail,
  getDashboardLogs,
  getDashboardStats,
  type RiskLevel,
} from '../controllers/dashboard.controller.js';
import { retryTask } from '../controllers/webhook.controller.js';
import { logger } from '../../shared/logger.js';

const logsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  pipelineId: z.string().optional(),
  riskLevel: z.enum(['Low', 'Medium', 'High']).optional(),
});

export function setupDashboardRoutes(app: Express): void {
  app.get('/api/stats', async (_req: Request, res: Response): Promise<void> => {
    try {
      const stats = await getDashboardStats();

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('GET /api/stats failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  app.get('/api/logs', async (req: Request, res: Response): Promise<void> => {
    try {
      const query = logsQuerySchema.parse(req.query);

      const logs = await getDashboardLogs({
        page: query.page,
        limit: query.limit,
        status: query.status,
        pipelineId: query.pipelineId,
        riskLevel: query.riskLevel as RiskLevel | undefined,
      });

      res.status(200).json({
        success: true,
        data: logs.data,
        pagination: logs.pagination,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Invalid query parameters',
          errors: error.errors,
        });
        return;
      }

      logger.error('GET /api/logs failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  app.get('/api/logs/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const log = await getDashboardLogDetail(id);

      if (!log) {
        res.status(404).json({
          success: false,
          message: 'Log not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: log,
      });
    } catch (error) {
      logger.error('GET /api/logs/:id failed', {
        id: req.params.id,
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  app.post('/api/tasks/:id/retry', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await retryTask(id);

      res.status(200).json({
        success: true,
        message: 'Task re-enqueued successfully',
        data: result,
      });
    } catch (error) {
      logger.error('POST /api/tasks/:id/retry failed', {
        id: req.params.id,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: 'Task not found',
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });
}
