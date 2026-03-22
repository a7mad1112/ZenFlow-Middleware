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
  webhookTargetUrl?: string;
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

type ActionExecutionState = 'success' | 'failed' | 'pending' | 'skipped';

type ActionExecutionMap = {
  xml: ActionExecutionState;
  ai: ActionExecutionState;
  discord: ActionExecutionState;
  pdf: ActionExecutionState;
  email: ActionExecutionState;
};

type PreviousTaskResult = {
  actionType?: string;
  origin?: 'MANUAL' | 'WEBHOOK';
  aiSummary?: string;
  riskLevel?: 'Low' | 'Medium' | 'High';
  xmlOutput?: string;
  pdfUrl?: string;
  actions: ActionExecutionMap;
  pdf: Record<string, unknown>;
  email: Record<string, unknown>;
  discord: Record<string, unknown>;
};

function normalizeActionExecutionState(value: unknown): ActionExecutionState {
  if (typeof value !== 'string') {
    return 'pending';
  }

  const normalized = value.toLowerCase();
  if (normalized === 'success') return 'success';
  if (normalized === 'failed') return 'failed';
  if (normalized === 'skipped') return 'skipped';
  return 'pending';
}

function extractPreviousTaskResult(result: unknown): PreviousTaskResult {
  const defaults: PreviousTaskResult = {
    actions: {
      xml: 'pending',
      ai: 'pending',
      discord: 'pending',
      pdf: 'pending',
      email: 'pending',
    },
    pdf: {},
    email: {},
    discord: {},
  };

  if (typeof result === 'string') {
    return {
      ...defaults,
      xmlOutput: result,
      actions: {
        ...defaults.actions,
        xml: 'success',
      },
    };
  }

  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return defaults;
  }

  const obj = result as Record<string, unknown>;
  const actionsObj =
    obj.actions && typeof obj.actions === 'object' && !Array.isArray(obj.actions)
      ? (obj.actions as Record<string, unknown>)
      : null;

  const xmlOutput =
    typeof obj.xmlOutput === 'string'
      ? obj.xmlOutput
      : typeof obj.xml === 'string'
        ? obj.xml
        : undefined;

  const riskCandidate =
    typeof obj.riskLevel === 'string' && ['low', 'medium', 'high'].includes(obj.riskLevel.toLowerCase())
      ? (obj.riskLevel.charAt(0).toUpperCase() + obj.riskLevel.slice(1).toLowerCase()) as 'Low' | 'Medium' | 'High'
      : undefined;

  return {
    actionType: typeof obj.actionType === 'string' ? obj.actionType : undefined,
    origin:
      typeof obj.origin === 'string' && obj.origin.toUpperCase() === 'MANUAL'
        ? 'MANUAL'
        : typeof obj.origin === 'string' && obj.origin.toUpperCase() === 'WEBHOOK'
          ? 'WEBHOOK'
          : undefined,
    aiSummary: typeof obj.aiSummary === 'string' ? obj.aiSummary : undefined,
    riskLevel: riskCandidate,
    xmlOutput,
    pdfUrl: typeof obj.pdfUrl === 'string' ? obj.pdfUrl : undefined,
    actions: {
      xml: normalizeActionExecutionState(actionsObj?.xml),
      ai: normalizeActionExecutionState(actionsObj?.ai),
      discord: normalizeActionExecutionState(actionsObj?.discord),
      pdf: normalizeActionExecutionState(actionsObj?.pdf),
      email: normalizeActionExecutionState(actionsObj?.email),
    },
    pdf: obj.pdf && typeof obj.pdf === 'object' && !Array.isArray(obj.pdf) ? (obj.pdf as Record<string, unknown>) : {},
    email:
      obj.email && typeof obj.email === 'object' && !Array.isArray(obj.email)
        ? (obj.email as Record<string, unknown>)
        : {},
    discord:
      obj.discord && typeof obj.discord === 'object' && !Array.isArray(obj.discord)
        ? (obj.discord as Record<string, unknown>)
        : {},
  };
}

function hasFailedActions(actions: ActionExecutionMap): boolean {
  return Object.values(actions).some((state) => state === 'failed');
}

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

function resolveTaskOrigin(payload: Record<string, unknown>): 'MANUAL' | 'WEBHOOK' {
  const metadata = getRequestMetadata(payload);
  const origin = metadata.origin;

  if (typeof origin === 'string' && origin.trim().toUpperCase() === 'MANUAL') {
    return 'MANUAL';
  }

  return 'WEBHOOK';
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
  const { pipelineId, logId, payload, webhookId, webhookTargetUrl } = taskData;
  const prismaAny = prisma as any;
  let xmlOutput: string | null = null;
  let resultDetails: Record<string, unknown> | null = null;
  let aiSummary = 'New Order Received';
  let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';
  let attemptNumber = 1;
  let maxAttempts = 5;

  try {
    logger.info('Processing task from queue', {
      taskId: logId,
      pipelineId,
      webhookId,
    });

    const existingTask = await prisma.task.findUnique({
      where: { id: logId },
      select: {
        status: true,
        attempts: true,
        maxAttempts: true,
        result: true,
      },
    });

    if (!existingTask) {
      throw new Error(`Task ${logId} not found`);
    }

    if (existingTask.status.toLowerCase() === 'stuck') {
      logger.warn('Skipping processing for task already marked as STUCK', { taskId: logId });
      return;
    }

    attemptNumber = (existingTask.attempts ?? 0) + 1;
    maxAttempts = Math.max(1, existingTask.maxAttempts ?? 5);

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

    logger.debug('Task marked as PROCESSING', { taskId: logId, attemptNumber, maxAttempts });

    const pipeline = await prisma.pipeline.findUnique({
      where: { id: pipelineId },
    });

    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    const runtimeConfig = getPipelineRuntimeConfig(pipeline.config);
    const matchedWebhook = webhookId
      ? await prisma.webhook.findUnique({
          where: { id: webhookId },
          select: { url: true },
        })
      : null;

    const effectiveDiscordWebhookUrl =
      webhookTargetUrl ?? matchedWebhook?.url ?? runtimeConfig.discordWebhookUrl;
    const taskOrigin = resolveTaskOrigin(payload);

    const previous = extractPreviousTaskResult(existingTask.result);

    if (previous.xmlOutput) {
      xmlOutput = previous.xmlOutput;
    }

    if (previous.aiSummary && previous.aiSummary.trim() !== '') {
      aiSummary = previous.aiSummary;
    }

    if (previous.riskLevel) {
      riskLevel = previous.riskLevel;
    }

    const actions: ActionExecutionMap = {
      xml: previous.actions.xml,
      ai: previous.actions.ai,
      discord: previous.actions.discord,
      pdf: previous.actions.pdf,
      email: previous.actions.email,
    };

    resultDetails = {
      actionType: pipeline.actionType,
      origin: previous.origin ?? taskOrigin,
      aiSummary,
      riskLevel,
      xml: xmlOutput,
      xmlOutput,
      pdfUrl: previous.pdfUrl ?? null,
      actions,
      pdf: Object.keys(previous.pdf).length > 0 ? previous.pdf : { status: 'pending', generated: false },
      email:
        Object.keys(previous.email).length > 0
          ? previous.email
          : {
              status: 'pending',
              attempted: false,
              sent: false,
            },
      discord:
        Object.keys(previous.discord).length > 0
          ? previous.discord
          : {
              status: 'pending',
              attempted: false,
              sent: false,
            },
      runtimeConfigSource: {
        discord: webhookTargetUrl
          ? 'webhook configuration (job payload)'
          : matchedWebhook?.url
            ? 'webhook configuration (database)'
            : runtimeConfig.discordWebhookUrl
              ? 'pipeline.config.discordWebhookUrl'
              : 'global env',
        smtp: runtimeConfig.smtp?.user ? 'pipeline.config.smtp' : 'global env',
      },
      retry: {
        attemptNumber,
        maxAttempts,
      },
    };

    const aiEnabledByPipeline = isActionEnabledForPipeline(pipeline as any, 'AI_SUMMARIZER');
    const aiSkippedByMetadata = aiEnabledByPipeline && shouldSkipActionForRequest(payload, 'AI_SUMMARIZER');
    const aiEnabledForRequest = aiEnabledByPipeline && !aiSkippedByMetadata;

    if (actions.ai === 'success' && typeof aiSummary === 'string' && aiSummary.trim() !== '') {
      logger.info('Skipping AI action because previous attempt already succeeded', {
        taskId: logId,
        attemptNumber,
      });
    } else if (!aiEnabledForRequest) {
      actions.ai = 'skipped';
      resultDetails.aiSummary = 'New Order Received';
      aiSummary = 'New Order Received';
    } else {
      try {
        aiSummary = await aiService.summarizeOrder(payload);
        actions.ai = 'success';
        resultDetails.aiSummary = aiSummary;
      } catch (aiError) {
        aiSummary = 'New Order Received';
        resultDetails.aiSummary = aiSummary;
        actions.ai = 'failed';
        logger.warn('AI summary generation failed', {
          taskId: logId,
          attemptNumber,
          error: aiError instanceof Error ? aiError.message : String(aiError),
        });
      }
    }

    riskLevel = extractRiskLevel(aiSummary);
    resultDetails.riskLevel = riskLevel;

    const converterEnabledByPipeline = isActionEnabledForPipeline(pipeline as any, 'CONVERTER');

    if (actions.xml === 'success' && xmlOutput) {
      logger.info('Skipping XML action because previous attempt already succeeded', {
        taskId: logId,
        attemptNumber,
      });
      resultDetails.xml = xmlOutput;
      resultDetails.xmlOutput = xmlOutput;
    } else if (!converterEnabledByPipeline) {
      actions.xml = 'skipped';
      resultDetails.primaryAction = {
        type: 'CONVERTER',
        enabled: false,
        status: 'skipped',
        skippedReason: 'disabled in Pipeline settings',
      };
    } else {
      try {
        xmlOutput = await handleConverterAction(payload);
        actions.xml = 'success';
        resultDetails.xml = xmlOutput;
        resultDetails.xmlOutput = xmlOutput;
        resultDetails.primaryAction = {
          type: 'CONVERTER',
          enabled: true,
          status: 'completed',
        };
      } catch (xmlError) {
        actions.xml = 'failed';
        resultDetails.primaryAction = {
          type: 'CONVERTER',
          enabled: true,
          status: 'failed',
          error: xmlError instanceof Error ? xmlError.message : String(xmlError),
        };
      }
    }

    let pdfBuffer: Buffer | undefined;
    const previousPdfBase64 =
      typeof (previous.pdf.contentBase64 as string | undefined) === 'string'
        ? (previous.pdf.contentBase64 as string)
        : undefined;

    if (actions.pdf === 'success' && previousPdfBase64) {
      pdfBuffer = Buffer.from(previousPdfBase64, 'base64');
      logger.info('Skipping PDF action because previous attempt already succeeded', {
        taskId: logId,
        attemptNumber,
      });
    } else {
      const pdfEnabledByPipeline = isActionEnabledForPipeline(pipeline as any, 'PDF');
      const pdfSkippedByMetadata = pdfEnabledByPipeline && shouldSkipActionForRequest(payload, 'PDF');

      if (!pdfEnabledByPipeline || pdfSkippedByMetadata) {
        actions.pdf = 'skipped';
        resultDetails.pdf = {
          status: 'skipped',
          generated: false,
          skippedReason: pdfSkippedByMetadata ? 'metadata.skipPDF=true' : 'disabled in Pipeline settings',
        };
      } else {
        try {
          pdfBuffer = await generateInvoice(payload);
          const pdfBase64 = pdfBuffer.toString('base64');
          const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;
          actions.pdf = 'success';
          resultDetails.pdf = {
            status: 'success',
            generated: true,
            sizeBytes: pdfBuffer.length,
            contentBase64: pdfBase64,
            url: pdfDataUrl,
          };
          resultDetails.pdfUrl = pdfDataUrl;
        } catch (pdfError) {
          actions.pdf = 'failed';
          resultDetails.pdf = {
            status: 'failed',
            generated: false,
            error: pdfError instanceof Error ? pdfError.message : String(pdfError),
          };
        }
      }
    }

    const customerEmail = extractCustomerEmail(payload);
    const emailEnabledByPipeline = isActionEnabledForPipeline(pipeline as any, 'EMAIL');
    const emailSkippedByMetadata = emailEnabledByPipeline && shouldSkipActionForRequest(payload, 'EMAIL');
    const emailEnabled = emailEnabledByPipeline && !emailSkippedByMetadata;

    if (actions.email === 'success') {
      logger.info('Skipping Email action because previous attempt already succeeded', {
        taskId: logId,
        attemptNumber,
      });
    } else if (!emailEnabled) {
      actions.email = 'skipped';
      resultDetails.email = {
        status: 'skipped',
        attempted: false,
        sent: false,
        skippedReason: emailSkippedByMetadata ? 'metadata.skipEmail=true' : 'disabled in Pipeline settings',
      };
    } else if (!customerEmail) {
      actions.email = 'skipped';
      resultDetails.email = {
        status: 'skipped',
        attempted: false,
        sent: false,
        skippedReason: 'customer.email not present',
      };
    } else {
      try {
        await emailService.sendOrderConfirmation(customerEmail, payload, {
          attachment: pdfBuffer,
          aiSummary,
          smtpConfig: runtimeConfig.smtp,
        });
        actions.email = 'success';
        resultDetails.email = {
          status: 'success',
          attempted: true,
          sent: true,
          to: customerEmail,
          attachedPdf: Boolean(pdfBuffer),
        };
      } catch (emailError) {
        actions.email = 'failed';
        resultDetails.email = {
          status: 'failed',
          attempted: true,
          sent: false,
          to: customerEmail,
          attachedPdf: Boolean(pdfBuffer),
          error: emailError instanceof Error ? emailError.message : String(emailError),
        };
      }
    }

    const skipDiscord = shouldSkipActionForRequest(payload, 'DISCORD');
    const discordEnabled = isActionEnabledForPipeline(pipeline as any, 'DISCORD');

    if (actions.discord === 'success') {
      logger.info('Skipping Discord action because previous attempt already succeeded', {
        taskId: logId,
        attemptNumber,
      });
    } else if (skipDiscord) {
      actions.discord = 'skipped';
      resultDetails.discord = {
        status: 'skipped',
        attempted: false,
        sent: false,
        skippedReason: 'metadata.skipDiscord=true',
      };
    } else if (!discordEnabled) {
      actions.discord = 'skipped';
      resultDetails.discord = {
        status: 'skipped',
        attempted: false,
        sent: false,
        skippedReason: 'disabled in Pipeline settings',
      };
    } else {
      try {
        const discordDispatch = await sendXmlToDiscord(xmlOutput, aiSummary, effectiveDiscordWebhookUrl, payload);
        if (discordDispatch.status === 'skipped_no_content') {
          actions.discord = 'skipped';
          resultDetails.discord = {
            status: 'skipped',
            attempted: false,
            sent: false,
            skippedReason: discordDispatch.reason ?? 'No content available for Discord',
          };
        } else {
          actions.discord = 'success';
          resultDetails.discord = {
            status: 'success',
            attempted: true,
            sent: true,
            mode: discordDispatch.hadAttachment ? 'xml_attachment' : 'text_only',
          };
        }
      } catch (discordError) {
        actions.discord = 'failed';
        resultDetails.discord = {
          status: 'failed',
          attempted: true,
          sent: false,
          error: discordError instanceof Error ? discordError.message : String(discordError),
        };
      }
    }

    if (hasFailedActions(actions)) {
      throw new Error('One or more actions failed in this attempt. Atomic retry required.');
    }

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
          error: null,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    logger.info('Task completed successfully', {
      taskId: logId,
      pipelineId,
      attemptNumber,
    });
  } catch (error) {
    logger.error('Task processing failed', {
      taskId: logId,
      pipelineId,
      attemptNumber,
      maxAttempts,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    const exhaustedRetries = attemptNumber >= maxAttempts;
    const nextStatus = exhaustedRetries ? 'stuck' : 'failed';

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
            status: nextStatus,
            error: error instanceof Error ? error.message : String(error),
            ...(resultDetails !== null ? { result: resultDetails as any } : {}),
            updatedAt: new Date(),
          },
        });
      }

      logger.info(exhaustedRetries ? 'Task marked as STUCK' : 'Task marked as FAILED', {
        taskId: logId,
        attemptNumber,
        maxAttempts,
      });
    } catch (updateError) {
      logger.error('Failed to update task status after processing error', {
        taskId: logId,
        error: updateError instanceof Error ? updateError.message : String(updateError),
      });
    }

    if (exhaustedRetries) {
      return;
    }

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
