import PgBoss from 'pg-boss';
import { PrismaClient } from '@prisma/client';
import { logger } from '../shared/logger.js';
import { jsonToXml, sanitizeObjectForXml } from '../shared/transformers.js';
import { config } from '../config/env.js';
import { sendXmlToDiscord } from '../services/discord.service.js';
import { emailService } from '../services/email.service.js';
import { generateInvoice } from '../services/pdf.service.js';
import { aiService } from '../services/ai.service.js';

const prisma = new PrismaClient();

export interface TaskPayload {
  pipelineId: string;
  webhookId?: string;
  payload: Record<string, unknown>;
  logId: string;
}

type SupportedAction = 'CONVERTER' | 'EMAIL' | 'DISCORD' | 'PDF' | 'AI_SUMMARIZER';
type MetadataSkipKey = 'skipDiscord' | 'skipEmail' | 'skipAI' | 'skipPDF';

type PipelineRuntimeConfig = {
  discordWebhookUrl?: string;
  smtp?: {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    pass?: string;
    from?: string;
  };
};

function extractRiskLevel(aiSummary: string): 'Low' | 'Medium' | 'High' {
  const match = aiSummary.match(/Risk:\s*(Low|Medium|High)/i);
  if (!match) {
    return 'Low';
  }

  const normalized = match[1].toLowerCase();
  if (normalized === 'high') return 'High';
  if (normalized === 'medium') return 'Medium';
  return 'Low';
}

function getEnabledActionsSet(pipeline: any): Set<string> | null {
  const enabledActions = pipeline?.enabledActions;
  if (!Array.isArray(enabledActions)) {
    return null;
  }

  return new Set(
    enabledActions
      .filter((action) => typeof action === 'string' && action.trim().length > 0)
      .map((action) => action.trim().toUpperCase())
  );
}

function isActionEnabledForPipeline(pipeline: any, action: SupportedAction): boolean {
  const enabledActions = getEnabledActionsSet(pipeline);
  const listedAsEnabled = enabledActions ? enabledActions.has(action) : true;

  if (action === 'EMAIL') {
    const emailFlag = typeof pipeline?.emailEnabled === 'boolean' ? pipeline.emailEnabled : true;
    return listedAsEnabled && emailFlag;
  }

  if (action === 'DISCORD') {
    const discordFlag = typeof pipeline?.discordEnabled === 'boolean' ? pipeline.discordEnabled : true;
    return listedAsEnabled && discordFlag;
  }

  return listedAsEnabled;
}

function getRequestMetadata(payload: Record<string, unknown>): Record<string, unknown> {
  const metadata = payload.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  return metadata as Record<string, unknown>;
}

function hasMetadataSkipFlag(payload: Record<string, unknown>, key: MetadataSkipKey): boolean {
  const metadata = getRequestMetadata(payload);
  return metadata[key] === true;
}

function shouldSkipActionForRequest(
  payload: Record<string, unknown>,
  action: SupportedAction
): boolean {
  if (action === 'DISCORD') return hasMetadataSkipFlag(payload, 'skipDiscord');
  if (action === 'EMAIL') return hasMetadataSkipFlag(payload, 'skipEmail');
  if (action === 'AI_SUMMARIZER') return hasMetadataSkipFlag(payload, 'skipAI');
  if (action === 'PDF') return hasMetadataSkipFlag(payload, 'skipPDF');
  return false;
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

function getPipelineRuntimeConfig(rawConfig: unknown): PipelineRuntimeConfig {
  if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
    return {};
  }

  const cfg = rawConfig as Record<string, unknown>;
  const smtpConfig =
    cfg.smtp && typeof cfg.smtp === 'object' && !Array.isArray(cfg.smtp)
      ? (cfg.smtp as Record<string, unknown>)
      : null;

  return {
    discordWebhookUrl:
      typeof cfg.discordWebhookUrl === 'string' && cfg.discordWebhookUrl.trim() !== ''
        ? cfg.discordWebhookUrl.trim()
        : undefined,
    smtp: smtpConfig
      ? {
          host: typeof smtpConfig.host === 'string' ? smtpConfig.host : undefined,
          port: typeof smtpConfig.port === 'number' ? smtpConfig.port : undefined,
          secure: typeof smtpConfig.secure === 'boolean' ? smtpConfig.secure : undefined,
          user: typeof smtpConfig.user === 'string' ? smtpConfig.user : undefined,
          pass: typeof smtpConfig.pass === 'string' ? smtpConfig.pass : undefined,
          from: typeof smtpConfig.from === 'string' ? smtpConfig.from : undefined,
        }
      : undefined,
  };
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
 * Central task processing function
 * Fetches pipeline, identifies action, executes, and updates DB
 */
async function processTask(taskData: TaskPayload): Promise<void> {
  const { pipelineId, logId, payload, webhookId } = taskData;
  const prismaAny = prisma as any;
  let xmlOutput: string | null = null;
  let resultDetails: Record<string, unknown> | null = null;
  let aiSummary = 'New Order Received';
  let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';

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

    const runtimeConfig = getPipelineRuntimeConfig(pipeline.config);

    const aiEnabledByPipeline = isActionEnabledForPipeline(pipeline as any, 'AI_SUMMARIZER');
    const aiSkippedByMetadata = aiEnabledByPipeline && shouldSkipActionForRequest(payload, 'AI_SUMMARIZER');
    const aiEnabledForRequest = aiEnabledByPipeline && !aiSkippedByMetadata;

    resultDetails = {
      actionType: pipeline.actionType,
      aiSummary,
      riskLevel,
      xml: null,
      xmlOutput: null,
      pdfUrl: null,
      actions: {
        xml: 'pending',
        ai: aiEnabledForRequest ? 'pending' : 'skipped',
        discord: 'pending',
        pdf: 'pending',
        email: 'pending',
      },
      pdf: {
        status: 'pending',
        generated: false,
      },
      email: {
        status: 'pending',
        attempted: false,
        sent: false,
      },
      discord: {
        status: 'pending',
        attempted: false,
        sent: false,
      },
      runtimeConfigSource: {
        discord: runtimeConfig.discordWebhookUrl ? 'pipeline.config.discordWebhookUrl' : 'global env',
        smtp: runtimeConfig.smtp?.user ? 'pipeline.config.smtp' : 'global env',
      },
    };

    if (!aiEnabledForRequest) {
      aiSummary = 'New Order Received';
      logger.info('AI summarizer skipped; using fallback summary', {
        taskId: logId,
        pipelineId: pipelineId,
        reason: aiEnabledByPipeline ? 'metadata.skipAI=true' : 'disabled in Pipeline settings',
      });
      (resultDetails.actions as Record<string, unknown>).ai = 'skipped';
    } else {
      try {
        aiSummary = await aiService.summarizeOrder(payload);
        logger.info('AI summary generated successfully', {
          taskId: logId,
          pipelineId: pipelineId,
        });
        (resultDetails.actions as Record<string, unknown>).ai = 'success';
      } catch (aiError) {
        aiSummary = 'New Order Received';
        logger.warn('AI summary generation failed; using fallback summary', {
          taskId: logId,
          pipelineId: pipelineId,
          error: aiError instanceof Error ? aiError.message : String(aiError),
        });
        (resultDetails.actions as Record<string, unknown>).ai = 'failed';
      }
    }

    riskLevel = extractRiskLevel(aiSummary);
    resultDetails.aiSummary = aiSummary;
    resultDetails.riskLevel = riskLevel;

    const converterEnabledByPipeline = isActionEnabledForPipeline(pipeline as any, 'CONVERTER');
    const converterEnabledForRequest = converterEnabledByPipeline;

    if (!converterEnabledForRequest) {
      (resultDetails.actions as Record<string, unknown>).xml = 'skipped';
      resultDetails.primaryAction = {
        type: 'CONVERTER',
        enabled: false,
        status: 'skipped',
        skippedReason: 'disabled in Pipeline settings',
      };
    } else {
      xmlOutput = await handleConverterAction(payload);
      resultDetails.xml = xmlOutput;
      resultDetails.xmlOutput = xmlOutput;
      (resultDetails.actions as Record<string, unknown>).xml = 'success';
      resultDetails.primaryAction = {
        type: 'CONVERTER',
        enabled: true,
        status: 'completed',
      };
    }

    if (xmlOutput !== null) {
      logger.info('Converter output persisted into task result details', {
        taskId: logId,
        pipelineId,
        xmlLength: xmlOutput.length,
      });
    }

    let pdfBuffer: Buffer | undefined;
    const pdfEnabledByPipeline = isActionEnabledForPipeline(pipeline as any, 'PDF');
      const pdfSkippedByMetadata = pdfEnabledByPipeline && shouldSkipActionForRequest(payload, 'PDF');

      if (!pdfEnabledByPipeline || pdfSkippedByMetadata) {
        resultDetails.pdf = {
          status: 'skipped',
          generated: false,
          skippedReason: pdfSkippedByMetadata
            ? 'metadata.skipPDF=true'
            : 'disabled in Pipeline settings',
        };
        (resultDetails.actions as Record<string, unknown>).pdf = 'skipped';
      } else {
        try {
          pdfBuffer = await generateInvoice(payload);
          const pdfBase64 = pdfBuffer.toString('base64');
          const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;

          logger.info(`✅ PDF generated (size: ${pdfBuffer.length} bytes)`, {
            taskId: logId,
            pipelineId: pipelineId,
          });
          resultDetails.pdf = {
            status: 'success',
            generated: true,
            sizeBytes: pdfBuffer.length,
            contentBase64: pdfBase64,
            url: pdfDataUrl,
          };
          resultDetails.pdfUrl = pdfDataUrl;
          (resultDetails.actions as Record<string, unknown>).pdf = 'success';
        } catch (pdfError) {
          logger.warn('Sending email without PDF attachment due to generation error', {
            taskId: logId,
            pipelineId: pipelineId,
            error: pdfError instanceof Error ? pdfError.message : String(pdfError),
          });
          resultDetails.pdf = {
            status: 'failed',
            generated: false,
            error: pdfError instanceof Error ? pdfError.message : String(pdfError),
          };
          (resultDetails.actions as Record<string, unknown>).pdf = 'failed';
        }
      }

      const customerEmail = extractCustomerEmail(payload);
      const emailEnabledByPipeline = isActionEnabledForPipeline(pipeline as any, 'EMAIL');
      const emailSkippedByMetadata =
        emailEnabledByPipeline && shouldSkipActionForRequest(payload, 'EMAIL');
      const emailEnabled = emailEnabledByPipeline && !emailSkippedByMetadata;

      if (!emailEnabled) {
        resultDetails.email = {
          status: 'skipped',
          attempted: false,
          sent: false,
          skippedReason: emailSkippedByMetadata
            ? 'metadata.skipEmail=true'
            : 'disabled in Pipeline settings',
        };
        (resultDetails.actions as Record<string, unknown>).email = 'skipped';
      } else if (customerEmail) {
        try {
          logger.info('Sending order confirmation email', {
            taskId: logId,
            pipelineId: pipelineId,
            to: customerEmail,
          });

          await emailService.sendOrderConfirmation(customerEmail, payload, {
            attachment: pdfBuffer,
            aiSummary,
            smtpConfig: runtimeConfig.smtp,
          });
          resultDetails.email = {
            status: 'success',
            attempted: true,
            sent: true,
            to: customerEmail,
            attachedPdf: Boolean(pdfBuffer),
          };
          (resultDetails.actions as Record<string, unknown>).email = 'success';
        } catch (emailError) {
          logger.error('Order confirmation email failed', {
            taskId: logId,
            pipelineId: pipelineId,
            to: customerEmail,
            error: emailError instanceof Error ? emailError.message : String(emailError),
          });
          resultDetails.email = {
            status: 'failed',
            attempted: true,
            sent: false,
            to: customerEmail,
            attachedPdf: Boolean(pdfBuffer),
            error: emailError instanceof Error ? emailError.message : String(emailError),
          };
          (resultDetails.actions as Record<string, unknown>).email = 'failed';
        }
      } else {
        logger.info('Skipping order confirmation email: customer.email not present', {
          taskId: logId,
          pipelineId: pipelineId,
        });
        resultDetails.email = {
          status: 'skipped',
          attempted: false,
          sent: false,
          skippedReason: 'customer.email not present',
        };
        (resultDetails.actions as Record<string, unknown>).email = 'skipped';
      }

      const skipDiscord = shouldSkipActionForRequest(payload, 'DISCORD');
      const discordEnabled = isActionEnabledForPipeline(pipeline as any, 'DISCORD');

      if (skipDiscord) {
        logger.info('Skipping Discord action: metadata.skipDiscord=true', {
          taskId: logId,
          pipelineId: pipelineId,
        });
        resultDetails.discord = {
          status: 'skipped',
          attempted: false,
          sent: false,
          skippedReason: 'metadata.skipDiscord=true',
        };
        (resultDetails.actions as Record<string, unknown>).discord = 'skipped';
      } else if (!discordEnabled) {
        logger.info('Skipping Discord action: disabled in Pipeline settings', {
          taskId: logId,
          pipelineId: pipelineId,
        });
        resultDetails.discord = {
          status: 'skipped',
          attempted: false,
          sent: false,
          skippedReason: 'disabled in Pipeline settings',
        };
        (resultDetails.actions as Record<string, unknown>).discord = 'skipped';
      } else if (!xmlOutput) {
        resultDetails.discord = {
          status: 'failed',
          attempted: false,
          sent: false,
          error: 'Discord action requires XML output but converter did not produce one',
        };
        (resultDetails.actions as Record<string, unknown>).discord = 'failed';
      } else {
        logger.info('Forwarding converter result to Discord', {
          taskId: logId,
          pipelineId: pipelineId,
        });

        try {
          await sendXmlToDiscord(xmlOutput, aiSummary, runtimeConfig.discordWebhookUrl);
          resultDetails.discord = {
            status: 'success',
            attempted: true,
            sent: true,
          };
          (resultDetails.actions as Record<string, unknown>).discord = 'success';

          logger.info('Converter result forwarded to Discord successfully', {
            taskId: logId,
            pipelineId: pipelineId,
          });
        } catch (discordError) {
          logger.error('Discord action failed but task will continue', {
            taskId: logId,
            pipelineId: pipelineId,
            error: discordError instanceof Error ? discordError.message : String(discordError),
          });
          resultDetails.discord = {
            status: 'failed',
            attempted: true,
            sent: false,
            error: discordError instanceof Error ? discordError.message : String(discordError),
          };
          (resultDetails.actions as Record<string, unknown>).discord = 'failed';
        }
      }

    // Update log/task status to PROCESSED with result
    if (prismaAny.webhookLog?.update) {
      await prismaAny.webhookLog.update({
        where: { id: logId },
        data: {
          status: 'PROCESSED',
          result: resultDetails,
          processedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.task.update({
        where: { id: logId },
        data: {
          status: 'completed',
          result: resultDetails as any,
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
            ...(resultDetails !== null ? { result: resultDetails } : {}),
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.task.update({
          where: { id: logId },
          data: {
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
            ...(resultDetails !== null ? { result: resultDetails as any } : {}),
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
