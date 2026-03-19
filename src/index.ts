import 'dotenv/config';
import express, { type Express, type Request, type Response } from 'express';
import PgBoss from 'pg-boss';
import { config } from './config/env.js';
import { logger } from './shared/logger.js';
import { setupWorkers } from './worker/taskHandler.js';
import { setupRoutes } from './api/routes.js';

const app: Express = express();

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
setupRoutes(app);

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const errorWithOptionalCause = error as Error & { cause?: unknown };

    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: errorWithOptionalCause.cause,
    };
  }

  return {
    value: error,
  };
}

async function main(): Promise<void> {
  try {
    logger.info('Starting webhook task processor...', {
      node_env: config.nodeEnv,
      port: config.port,
    });

    // Initialize PG-Boss
    const pgBoss = new PgBoss(config.databaseUrl);

    pgBoss.on('error', (error: Error): void => {
      logger.error('PG-Boss error:', serializeError(error));
    });

    await pgBoss.start();
    logger.info('PG-Boss initialized successfully');

    // Setup workers
    await setupWorkers(pgBoss);
    logger.info('Workers registered successfully');

    // Start Express server
    app.listen(config.port, (): void => {
      logger.info(`Server listening on port ${config.port}`);
    });
  } catch (error) {
    logger.error('Failed to start application:', serializeError(error));
    process.exit(1);
  }
}

main();
