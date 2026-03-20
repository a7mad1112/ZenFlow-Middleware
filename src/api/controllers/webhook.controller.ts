import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../../shared/logger.js';
import { getQueue } from '../../config/queue.js';

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
    let pipelineId: string;

    // First, try to find as a webhook
    const webhook = await prisma.webhook.findUnique({
      where: { id },
      include: { pipeline: true },
    });

    if (webhook) {
      // Found as webhook
      webhookId = webhook.id;
      pipelineId = webhook.pipelineId;

      if (!webhook.isActive) {
        logger.warn('Webhook is inactive', { webhookId });
        throw new Error(`Webhook ${webhookId} is inactive`);
      }

      logger.info('Webhook found', { webhookId, pipelineId });
    } else {
      // Not found as webhook, try to find as pipeline
      const pipeline = await prisma.pipeline.findUnique({
        where: { id },
      });

      if (!pipeline) {
        logger.warn('Webhook or Pipeline not found', { id });
        throw new Error(`Resource ${id} not found in Webhook or Pipeline`);
      }

      if (!pipeline.isActive) {
        logger.warn('Pipeline is inactive', { pipelineId: id });
        throw new Error(`Pipeline ${id} is inactive`);
      }

      pipelineId = pipeline.id;
      logger.info('Pipeline found (ingesting directly)', { pipelineId });
    }

    // Create a task record with PENDING status
    const task = await prisma.task.create({
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
      taskId: task.id,
      webhookId: webhookId,
      pipelineId: pipelineId,
    });

    // Queue the job using pg-boss
    const queue = getQueue();
    const jobId = await queue.send(
      'task-queue',
      {
        pipelineId: pipelineId,
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
      pipelineId: pipelineId,
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
      id: id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Create a webhook for a pipeline
 * @param pipelineId - The pipeline ID
 * @param data - Webhook data (eventType, url)
 * @returns Created webhook
 */
export async function createWebhook(
  pipelineId: string,
  data: { eventType: string; url: string }
): Promise<any> {
  try {
    // Verify pipeline exists
    const pipeline = await prisma.pipeline.findUnique({
      where: { id: pipelineId },
    });

    if (!pipeline) {
      logger.warn('Pipeline not found for webhook creation', { pipelineId });
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    // Create webhook
    const webhook = await prisma.webhook.create({
      data: {
        pipelineId: pipelineId,
        eventType: data.eventType,
        url: data.url,
      },
    });

    logger.info('Webhook created successfully', {
      webhookId: webhook.id,
      pipelineId: pipelineId,
      eventType: data.eventType,
    });

    return webhook;
  } catch (error) {
    logger.error('Failed to create webhook', {
      pipelineId: pipelineId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get all webhooks for a pipeline
 * @param pipelineId - The pipeline ID
 * @returns List of webhooks
 */
export async function getWebhooksByPipelineId(pipelineId: string): Promise<any[]> {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: { pipelineId },
      orderBy: { createdAt: 'desc' },
    });

    logger.debug('Webhooks retrieved', {
      pipelineId: pipelineId,
      count: webhooks.length,
    });

    return webhooks;
  } catch (error) {
    logger.error('Failed to retrieve webhooks', {
      pipelineId: pipelineId,
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
