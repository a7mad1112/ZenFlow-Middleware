import PgBoss from 'pg-boss';
import { PrismaClient } from '@prisma/client';
import { logger } from '../shared/logger.js';
import { jsonToXml, sanitizeObjectForXml } from '../shared/transformers.js';
import { config } from '../config/env.js';
import { sendXmlToDiscord } from '../services/discord.service.js';
import { emailService } from '../services/email.service.js';

const prisma = new PrismaClient();

export interface TaskPayload {
  pipelineId: string;
  webhookId?: string;
  payload: Record<string, unknown>;
  logId: string;
}

function isDiscordEnabledForPipeline(pipeline: any): boolean {
  if (typeof pipeline?.discordEnabled === 'boolean') {
    return pipeline.discordEnabled;
  }

  const enabledActions = pipeline?.enabledActions;
  if (Array.isArray(enabledActions)) {
    return enabledActions.includes('DISCORD');
  }

  const configDiscordEnabled = pipeline?.config?.discordEnabled;
  if (typeof configDiscordEnabled === 'boolean') {
    return configDiscordEnabled;
  }

  return true;
}

function shouldSkipDiscordForRequest(payload: Record<string, unknown>): boolean {
  const metadata = payload.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return false;
  }

  return (metadata as { skipDiscord?: unknown }).skipDiscord === true;
}

function extractCustomerEmail(payload: Record<string, unknown>): string | null {
  const customer = payload.customer;
  if (!customer || typeof customer !== 'object' || Array.isArray(customer)) {
    return null;
  }

  const email = (customer as { email?: unknown }).email;
  if (typeof email !== 'string' || email.trim() === '') {
    return null;
  }

  return email.trim();
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
  actionType: string,
  payload: Record<string, unknown>
): Promise<string> {
  switch (actionType) {
    case 'CONVERTER':
      return await handleConverterAction(payload);

    case 'EMAIL':
      return await handleEmailAction(payload);

    case 'DISCORD':
      return await handleDiscordAction(payload);

    case 'PDF':
      return await handlePdfAction(payload);

    case 'AI_SUMMARIZER':
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
  const prismaAny = prisma as any;
  let result: string | null = null;

  try {
    logger.info('Processing task from queue', {
      taskId: logId,
      pipelineId: pipelineId,
      webhookId: webhookId,
    });

    // Update log/task status to PROCESSING
    if (prismaAny.webhookLog?.update) {
      await prismaAny.webhookLog.update({
        where: { id: logId },
        data: {
          status: 'PROCESSING',
          attempts: { increment: 1 },
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.task.update({
        where: { id: logId },
        data: {
          status: 'processing',
          attempts: { increment: 1 },
          updatedAt: new Date(),
        },
      });
    }

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
    result = await executeAction(pipeline.actionType, payload);

    logger.info('Action executed successfully', {
      taskId: logId,
      actionType: pipeline.actionType,
      resultLength: result.length,
    });

    if (pipeline.actionType === 'CONVERTER') {
      const customerEmail = extractCustomerEmail(payload);
      if (customerEmail) {
        try {
          logger.info('Sending order confirmation email', {
            taskId: logId,
            pipelineId: pipelineId,
            to: customerEmail,
          });

          await emailService.sendOrderConfirmation(customerEmail, payload);
        } catch (emailError) {
          logger.error('Order confirmation email failed', {
            taskId: logId,
            pipelineId: pipelineId,
            to: customerEmail,
            error: emailError instanceof Error ? emailError.message : String(emailError),
          });
        }
      } else {
        logger.info('Skipping order confirmation email: customer.email not present', {
          taskId: logId,
          pipelineId: pipelineId,
        });
      }

      const skipDiscord = shouldSkipDiscordForRequest(payload);
      const discordEnabled = isDiscordEnabledForPipeline(pipeline as any);

      if (skipDiscord) {
        logger.info('Skipping Discord action: metadata.skipDiscord=true', {
          taskId: logId,
          pipelineId: pipelineId,
        });
      } else if (!discordEnabled) {
        logger.info('Skipping Discord action: disabled in Pipeline settings', {
          taskId: logId,
          pipelineId: pipelineId,
        });
      } else {
        logger.info('Forwarding converter result to Discord', {
          taskId: logId,
          pipelineId: pipelineId,
        });

        await sendXmlToDiscord(result);

        logger.info('Converter result forwarded to Discord successfully', {
          taskId: logId,
          pipelineId: pipelineId,
        });
      }
    }

    // Update log/task status to PROCESSED with result
    if (prismaAny.webhookLog?.update) {
      await prismaAny.webhookLog.update({
        where: { id: logId },
        data: {
          status: 'PROCESSED',
          result: result,
          processedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.task.update({
        where: { id: logId },
        data: {
          status: 'completed',
          result: result as any,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

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

    // Update log/task status to FAILED
    try {
      if (prismaAny.webhookLog?.update) {
        await prismaAny.webhookLog.update({
          where: { id: logId },
          data: {
            status: 'FAILED',
            error: error instanceof Error ? error.message : String(error),
            ...(result !== null ? { result: result } : {}),
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.task.update({
          where: { id: logId },
          data: {
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
            ...(result !== null ? { result: result as any } : {}),
            updatedAt: new Date(),
          },
        });
      }

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

    console.log('🔵 Starting worker subscriptions...');

    // Create worker instances
    const workers = Array.from({ length: workerCount }, (_, idx) =>
      pgBoss.work<TaskPayload>(
        'task-queue',
        {
          batchSize: 1,
        },
        async (jobs) => {
          console.log(`✅ Worker #${idx} subscription active and ready for jobs`);
          
          for (const job of jobs) {
            console.log('🚀 Worker #' + idx + ' picking up job:', job.id);
            console.log('🚀 WORKER: Processing logId:', job.data.logId);

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

    // Wait for all worker subscriptions to register
    await Promise.all(workers);
    
    console.log('✅ All worker subscriptions registered and active');

    logger.info(`✅ Worker engine started with ${workerCount} workers on task-queue`);
  } catch (error) {
    logger.error('Failed to start worker engine', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
