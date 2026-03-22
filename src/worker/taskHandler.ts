import PgBoss from 'pg-boss';
import { config } from '../config/env.js';
import { logger } from '../shared/logger.js';
import type { WebhookPayload, TaskResult } from '../models/types.js';

/**
 * Process webhook task
 * This handler will be invoked by pg-boss for each queued webhook
 */
async function processWebhookTask(payload: WebhookPayload): Promise<TaskResult> {
  try {
    logger.info('Processing webhook task', {
      webhook_id: payload.id,
      event_type: payload.eventType,
    });

    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    logger.info('Task completed successfully', {
      webhook_id: payload.id,
    });

    return {
      success: true,
      message: 'Task processed successfully',
    };
  } catch (error) {
    logger.error('Task processing failed', {
      webhook_id: payload.id,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      message: 'Task processing failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function setupWorkers(pgBoss: PgBoss): Promise<void> {
  try {
    const workers = Array.from({ length: config.workerConcurrency }, () =>
      pgBoss.work<WebhookPayload>(
        'process-webhook',
        {
          batchSize: 1,
        },
        async (jobs) => {
          for (const job of jobs) {
            await processWebhookTask(job.data);
          }
        }
      )
    );

    await Promise.all(workers);

    logger.info('Worker registered for process-webhook queue');
  } catch (error) {
    logger.error('Failed to setup workers', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
