import { initBoss, getBoss as getBossInstance, stopBoss } from '../lib/boss.js';
import { logger } from '../shared/logger.js';

/**
 * Start the shared PG-Boss queue instance
 * This wraps the centralized boss initialization
 */
export async function startQueue() {
  try {
    const boss = await initBoss();
    await boss.createQueue('task-queue');
    logger.info('✅ PG-Boss queue started successfully', {
      schema: 'pgboss',
      queueName: 'task-queue',
    });
    return boss;
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
 * Uses the centralized instance from lib/boss
 */
export function getQueue() {
  try {
    return getBossInstance();
  } catch (error) {
    logger.error('PG-Boss not initialized', {
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Stop the PG-Boss queue gracefully
 */
export async function stopQueue(): Promise<void> {
  try {
    await stopBoss();
    logger.info('✅ PG-Boss stopped gracefully');
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
  try {
    const boss = getBossInstance();
    // Send a test job to verify connectivity
    await boss.publish('__health_check__', { test: true }, { priority: 1 });
    return true;
  } catch (error) {
    logger.error('Queue health check failed:', {
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
