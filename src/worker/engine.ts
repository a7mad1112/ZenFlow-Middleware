import PgBoss from 'pg-boss';
import { PrismaClient, ActionType } from '@prisma/client';
import { logger } from '../shared/logger.js';
import { jsonToXml, sanitizeObjectForXml } from '../shared/transformers.js';
import { config } from '../config/env.js';

const prisma = new PrismaClient();

export interface TaskPayload {
  pipelineId: string;
  webhookId?: string;
  payload: Record<string, unknown>;
  logId: string;
}

/**
 * Action Handler: JSON to XML Converter
 * Converts incoming JSON payload to XML format
 */
async function handleConverterAction(
  payload: Record<string, unknown>
): Promise<string> {
  try {
    logger.debug('Executing CONVERTER action: JSON to XML');

    // Sanitize and convert
    const sanitized = sanitizeObjectForXml(payload);
    const xml = jsonToXml(sanitized, 'data');

    logger.debug('CONVERTER action completed successfully', {
      xmlLength: xml.length,
    });

    return xml;
  } catch (error) {
    logger.error('CONVERTER action failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Action Handler: Email Notification (Placeholder)
 * Sends email notification (stub for future implementation)
 */
async function handleEmailAction(
  payload: Record<string, unknown>
): Promise<string> {
  try {
    logger.debug('Executing EMAIL action');

    // Stub: For now just convert to JSON string
    const result = JSON.stringify(payload, null, 2);

    logger.debug('EMAIL action completed successfully');

    return result;
  } catch (error) {
    logger.error('EMAIL action failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Action Handler: Discord Notification (Placeholder)
 */
async function handleDiscordAction(
  payload: Record<string, unknown>
): Promise<string> {
  try {
    logger.debug('Executing DISCORD action');

    // Stub: For now just convert to JSON string
    const result = JSON.stringify(payload, null, 2);

    logger.debug('DISCORD action completed successfully');

    return result;
  } catch (error) {
    logger.error('DISCORD action failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Action Handler: PDF Generation (Placeholder)
 */
async function handlePdfAction(
  payload: Record<string, unknown>
): Promise<string> {
  try {
    logger.debug('Executing PDF action');

    // Stub: For now just convert to JSON string
    const result = JSON.stringify(payload, null, 2);

    logger.debug('PDF action completed successfully');

    return result;
  } catch (error) {
    logger.error('PDF action failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Action Handler: AI Summarization (Placeholder)
 */
async function handleAiSummarizerAction(
  payload: Record<string, unknown>
): Promise<string> {
  try {
    logger.debug('Executing AI_SUMMARIZER action');

    // Stub: For now just convert to JSON string
    const result = JSON.stringify(payload, null, 2);

    logger.debug('AI_SUMMARIZER action completed successfully');

    return result;
  } catch (error) {
    logger.error('AI_SUMMARIZER action failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Execute action based on ActionType
 * Dispatches to appropriate handler
 */
async function executeAction(
  actionType: ActionType,
  payload: Record<string, unknown>
): Promise<string> {
  switch (actionType) {
    case ActionType.CONVERTER:
      return await handleConverterAction(payload);

    case ActionType.EMAIL:
      return await handleEmailAction(payload);

    case ActionType.DISCORD:
      return await handleDiscordAction(payload);

    case ActionType.PDF:
      return await handlePdfAction(payload);

    case ActionType.AI_SUMMARIZER:
      return await handleAiSummarizerAction(payload);

    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }
}

/**
 * Central task processing function
 * Fetches pipeline, identifies action, executes, and updates DB
 */
async function processTask(taskData: TaskPayload): Promise<void> {
  const { pipelineId, logId, payload, webhookId } = taskData;

  try {
    logger.info('Processing task from queue', {
      taskId: logId,
      pipelineId: pipelineId,
      webhookId: webhookId,
    });

    // Update task status to PROCESSING
    await prisma.task.update({
      where: { id: logId },
      data: {
        status: 'processing',
        attempts: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    logger.debug('Task marked as PROCESSING', { taskId: logId });

    // Fetch pipeline to get ActionType
    const pipeline = await prisma.pipeline.findUnique({
      where: { id: pipelineId },
    });

    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    logger.info('Pipeline retrieved', {
      pipelineId: pipelineId,
      actionType: pipeline.actionType,
    });

    // Execute the action
    const result = await executeAction(pipeline.actionType, payload);

    logger.info('Action executed successfully', {
      taskId: logId,
      actionType: pipeline.actionType,
      resultLength: result.length,
    });

    // Update task status to COMPLETED with result
    await prisma.task.update({
      where: { id: logId },
      data: {
        status: 'completed',
        result: result as any,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    logger.info('Task completed successfully', {
      taskId: logId,
      pipelineId: pipelineId,
      actionType: pipeline.actionType,
    });
  } catch (error) {
    logger.error('Task processing failed', {
      taskId: logId,
      pipelineId: pipelineId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Update task status to FAILED
    try {
      await prisma.task.update({
        where: { id: logId },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          updatedAt: new Date(),
        },
      });

      logger.info('Task marked as FAILED', {
        taskId: logId,
        error: error instanceof Error ? error.message : String(error),
      });
    } catch (updateError) {
      logger.error('Failed to update task status to FAILED', {
        taskId: logId,
        error: updateError instanceof Error ? updateError.message : String(updateError),
      });
    }

    // Re-throw to let pg-boss handle retry logic
    throw error;
  }
}

/**
 * Initialize and start the task-queue worker
 * Listens for new jobs on the 'task-queue' and processes them
 */
export async function startWorkerEngine(pgBoss: PgBoss): Promise<void> {
  try {
    const workerCount = config.workerConcurrency;

    logger.info('Initializing worker engine', {
      queueName: 'task-queue',
      workerCount: workerCount,
      concurrency: config.workerConcurrency,
    });

    // Create worker instances
    const workers = Array.from({ length: workerCount }, () =>
      pgBoss.work<TaskPayload>(
        'task-queue',
        {
          batchSize: 1,
        },
        async (jobs) => {
          for (const job of jobs) {
            try {
              logger.debug('Processing job from queue', {
                jobId: job.id,
                taskId: job.data.logId,
              });

              await processTask(job.data);

              logger.debug('Job completed successfully', {
                jobId: job.id,
                taskId: job.data.logId,
              });
            } catch (error) {
              logger.error('Job processing error', {
                jobId: job.id,
                taskId: job.data.logId,
                error: error instanceof Error ? error.message : String(error),
              });

              // pg-boss will handle retry based on job configuration
              throw error;
            }
          }
        }
      )
    );

    await Promise.all(workers);

    logger.info(`✅ Worker engine started with ${workerCount} workers on task-queue`);
  } catch (error) {
    logger.error('Failed to start worker engine', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
