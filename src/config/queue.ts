import PgBoss from 'pg-boss';
import { logger } from '../shared/logger.js';
import { config } from './env.js';

let pgBoss: PgBoss | null = null;

/**
 * Initialize and start the PG-Boss queue instance
 * Creates internal PG-Boss tables on first run
 */
export async function startQueue(): Promise<PgBoss> {
  if (pgBoss) {
    logger.info('PG-Boss instance already running');
    return pgBoss;
  }

  try {
    pgBoss = new PgBoss({
      connectionString: config.databaseUrl,
      max: config.pgBossPoolSize,
      schema: 'pgboss',
      archiveCompletedAfterSeconds: 86400, // Keep completed jobs for 24 hours
    });

    // Attach error handler
    pgBoss.on('error', (error: Error): void => {
      logger.error('PG-Boss internal error:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    });

    // Start the queue
    await pgBoss.start();

    logger.info('✅ PG-Boss queue started successfully', {
      schema: 'pgboss',
      poolSize: config.pgBossPoolSize,
      database: config.databaseUrl.split('@')[1] || 'webhook_processor',
    });

    return pgBoss;
  } catch (error) {
    logger.error('❌ Failed to initialize PG-Boss:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Get the PG-Boss instance
 * Throws if queue hasn't been initialized
 */
export function getQueue(): PgBoss {
  if (!pgBoss) {
    throw new Error('PG-Boss queue not initialized. Call startQueue() first.');
  }
  return pgBoss;
}

/**
 * Stop the PG-Boss queue gracefully
 */
export async function stopQueue(): Promise<void> {
  if (!pgBoss) {
    logger.info('PG-Boss not running, nothing to stop');
    return;
  }

  try {
    await pgBoss.stop();
    logger.info('✅ PG-Boss stopped gracefully');
    pgBoss = null;
  } catch (error) {
    logger.error('Failed to stop PG-Boss:', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Verify queue connectivity (health check)
 */
export async function healthCheckQueue(): Promise<boolean> {
  if (!pgBoss) {
    return false;
  }

  try {
    // Send a test job to verify connectivity
    await pgBoss.publish('__health_check__', { test: true }, { priority: 1 });
    return true;
  } catch (error) {
    logger.error('Queue health check failed:', {
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
