import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../../shared/logger.js';
import { getQueue } from '../../config/queue.js';

const prisma = new PrismaClient();

export interface IngestWebhookDTO {
  payload: Record<string, unknown>;
}

/**
 * Ingest a webhook event and queue it for processing
 * @param webhookId - The webhook ID from the URL
 * @param data - The incoming webhook payload
 * @returns Task record with tracking ID
 */
export async function ingestWebhook(
  webhookId: string,
  data: IngestWebhookDTO
): Promise<any> {
  try {
    // Find the webhook with its pipeline
    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId },
      include: { pipeline: true },
    });

    if (!webhook) {
      logger.warn('Webhook not found', { webhookId });
      throw new Error(`Webhook ${webhookId} not found`);
    }

    if (!webhook.isActive) {
      logger.warn('Webhook is inactive', { webhookId });
      throw new Error(`Webhook ${webhookId} is inactive`);
    }

    // Create a task record with PENDING status
    const task = await prisma.task.create({
      data: {
        pipelineId: webhook.pipelineId,
        webhookId: webhookId,
        status: 'pending',
        payload: data.payload as any,
        attempts: 0,
        maxAttempts: 3,
      },
    });

    logger.info('Task created for webhook', {
      taskId: task.id,
      webhookId: webhookId,
      pipelineId: webhook.pipelineId,
    });

    // Queue the job using pg-boss
    const queue = getQueue();
    const jobId = await queue.send(
      'task-queue',
      {
        pipelineId: webhook.pipelineId,
        webhookId: webhookId,
        payload: data.payload,
        logId: task.id,
      },
      {
        priority: 5,
        retryLimit: 2,
        retryDelay: 5,
      }
    );

    logger.info('Job queued successfully in pg-boss', {
      taskId: task.id,
      jobId: jobId,
      webhookId: webhookId,
      queueName: 'task-queue',
    });

    return {
      id: task.id,
      status: task.status,
      jobId: jobId,
      createdAt: task.createdAt,
    };
  } catch (error) {
    logger.error('Failed to ingest webhook', {
      webhookId: webhookId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
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
