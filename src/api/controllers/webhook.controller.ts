import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../../shared/logger.js';
import { getBoss } from '../../lib/boss.js';

const prisma = new PrismaClient();

export interface IngestWebhookDTO {
  payload: Record<string, unknown>;
}

/**
 * Ingest a webhook event and queue it for processing
 * @param id - The webhook ID or pipeline ID from the URL
 * @param data - The incoming webhook payload
 * @returns Task record with tracking ID
 */
export async function ingestWebhook(
  id: string,
  data: IngestWebhookDTO
): Promise<any> {
  try {
    let webhookId: string | undefined;
    let pipelineId: string | undefined;

    // 1) Try Webhook table first
    const webhook = await prisma.webhook.findUnique({
      where: { id },
    });

    if (webhook) {
      if (!webhook.isActive) {
        logger.warn('Webhook is inactive', { webhookId: webhook.id });
        throw new Error(`Webhook ${webhook.id} is inactive`);
      }

      webhookId = webhook.id;
      pipelineId = webhook.pipelineId;
      logger.info('Webhook found for ingestion', { webhookId, pipelineId });
    }

    // 2) If not found in Webhook table, immediately try Pipeline table
    if (!pipelineId) {
      const pipeline = await prisma.pipeline.findUnique({
        where: { id },
      });

      if (!pipeline) {
        logger.warn('Resource not found in both Webhook and Pipeline tables', { id });
        throw new Error(`Resource ${id} not found`);
      }

      if (!pipeline.isActive) {
        logger.warn('Pipeline is inactive', { pipelineId: pipeline.id });
        throw new Error(`Pipeline ${pipeline.id} is inactive`);
      }

      pipelineId = pipeline.id;
      logger.info('Pipeline found for direct ingestion', { pipelineId });
    }

    // Create a task record with PENDING status
    const result = await prisma.task.create({
      data: {
        pipelineId: pipelineId,
        webhookId: webhookId || undefined,
        status: 'pending',
        payload: data.payload as any,
        attempts: 0,
        maxAttempts: 3,
      },
    });

    logger.info('Task created', {
      taskId: result.id,
      webhookId: webhookId,
      pipelineId: pipelineId,
    });

    // Queue the job using pg-boss
    const boss = getBoss();
    if (!boss) {
      throw new Error('Boss not initialized');
    }

    let jobId: string | null;
    try {
      console.log('🔵 Attempting to send job to boss...', {
        taskId: result.id,
        queueName: 'task-queue',
      });
      
      jobId = await boss.send(
        'task-queue',
        {
          logId: result.id,
          pipelineId: result.pipelineId,
          payload: data.payload,
        },
        {
          priority: 5,
          retryLimit: 2,
          retryDelay: 5,
        }
      );
      
      console.log('✅ boss.send() returned:', {
        taskId: result.id,
        jobId: jobId,
        type: typeof jobId,
      });
    } catch (error) {
      console.error('❌ Exception during boss.send():', {
        taskId: result.id,
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      logger.error('PG-Boss send error:', {
        taskId: result.id,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }

    if (!jobId) {
      throw new Error(`Failed to enqueue job for task ${result.id}`);
    }

    // Save the jobId back to the log/task record for tracking
    await prisma.task.update({
      where: { id: result.id },
      data: {
        result: {
          jobId,
          queueName: 'task-queue',
          queuedAt: new Date().toISOString(),
        } as any,
      },
    });

    logger.info('Job queued successfully in pg-boss', {
      taskId: result.id,
      jobId: jobId,
      webhookId: webhookId,
      pipelineId: pipelineId,
      queueName: 'task-queue',
    });

    return {
      id: result.id,
      status: result.status,
      jobId: jobId,
      createdAt: result.createdAt,
    };
  } catch (error) {
    logger.error('Failed to ingest webhook', {
      id: id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Create a webhook for a pipeline
 */
export async function createWebhook(
  pipelineId: string,
  data: { eventType: string; url: string }
): Promise<any> {
  try {
    const pipeline = await prisma.pipeline.findUnique({
      where: { id: pipelineId },
    });

    if (!pipeline) {
      logger.warn('Pipeline not found for webhook creation', { pipelineId });
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    const webhook = await prisma.webhook.create({
      data: {
        pipelineId,
        eventType: data.eventType,
        url: data.url,
      },
    });

    logger.info('Webhook created successfully', {
      webhookId: webhook.id,
      pipelineId,
      eventType: webhook.eventType,
    });

    return webhook;
  } catch (error) {
    logger.error('Failed to create webhook', {
      pipelineId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get all webhooks for a pipeline
 */
export async function getWebhooksByPipelineId(pipelineId: string): Promise<any[]> {
  try {
    return await prisma.webhook.findMany({
      where: { pipelineId },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    logger.error('Failed to retrieve webhooks', {
      pipelineId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get task status by ID
 * @param taskId - The task/log ID
 * @returns Task record with current status
 */
export async function getTaskStatus(taskId: string): Promise<any> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        webhook: {
          select: { id: true, eventType: true },
        },
        pipeline: {
          select: { id: true, name: true },
        },
      },
    });

    if (!task) {
      logger.warn('Task not found', { taskId });
      throw new Error(`Task ${taskId} not found`);
    }

    logger.debug('Task status retrieved', {
      taskId: task.id,
      status: task.status,
      attempts: task.attempts,
    });

    return task;
  } catch (error) {
    logger.error('Failed to retrieve task status', {
      taskId: taskId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Update task status after processing
 * @param taskId - The task ID
 * @param status - New status (processing, completed, failed)
 * @param result - Optional result data
 * @param error - Optional error message
 */
export async function updateTaskStatus(
  taskId: string,
  status: string,
  result?: Prisma.JsonValue,
  error?: string
): Promise<any> {
  try {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'completed') {
      updateData.completedAt = new Date();
      if (result) {
        updateData.result = result;
      }
    }

    if (status === 'failed' && error) {
      updateData.error = error;
      updateData.attempts = { increment: 1 };
    }

    if (status === 'processing') {
      updateData.attempts = { increment: 1 };
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
    });

    logger.info('Task status updated', {
      taskId: task.id,
      newStatus: task.status,
      attempts: task.attempts,
    });

    return task;
  } catch (error) {
    logger.error('Failed to update task status', {
      taskId: taskId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
