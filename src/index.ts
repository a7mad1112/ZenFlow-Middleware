import 'dotenv/config';
import express, { type Express, type Request, type Response } from 'express';
import { config } from './config/env.js';
import { startQueue, stopQueue, healthCheckQueue, getQueue } from './config/queue.js';
import { logger } from './shared/logger.js';
import { setupWorkers } from './worker/taskHandler.js';
import { setupRoutes } from './api/routes.js';
import { setupPipelineRoutes } from './api/routes/pipeline.routes.js';
import { setupWebhookRoutes } from './api/routes/webhook.routes.js';

const app: Express = express();

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', async (_req: Request, res: Response): Promise<void> => {
  const queueHealthy = await healthCheckQueue();

  res.status(queueHealthy ? 200 : 503).json({
    status: queueHealthy ? 'healthy' : 'degraded',
    queue: queueHealthy ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
setupRoutes(app);
setupPipelineRoutes(app);
setupWebhookRoutes(app);

async function main(): Promise<void> {
  try {
    logger.info('Starting webhook task processor...', {
      node_env: config.nodeEnv,
      port: config.port,
    });

    // Initialize PG-Boss queue
    await startQueue();

    // Setup workers
    const pgBoss = getQueue();
    await setupWorkers(pgBoss);
    logger.info('Workers registered successfully');

    // Start Express server
    app.listen(config.port, (): void => {
      logger.info(`🚀 Server listening on port ${config.port}`);
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      await stopQueue();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully...');
      await stopQueue();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start application:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

main();
