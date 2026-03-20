import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../../shared/logger.js';

const prisma = new PrismaClient();

export interface CreatePipelineDTO {
  name: string;
  description?: string;
  actionType: string;
  config?: Prisma.JsonValue;
}

export interface AddSubscriberDTO {
  targetUrl: string;
}

export interface UpdatePipelineActionsDTO {
  enabledActions?: string[];
  emailEnabled?: boolean;
  discordEnabled?: boolean;
}

export type ReadinessStatus = 'ready' | 'failed' | 'disabled' | 'unknown';

export interface ActionReadinessItem {
  action: string;
  enabled: boolean;
  status: ReadinessStatus;
  details: string;
}

export interface PipelineHealthReport {
  pipelineId: string;
  generatedAt: string;
  checks: ActionReadinessItem[];
}

/**
 * Create a new pipeline
 */
export async function createPipeline(
  data: CreatePipelineDTO
): Promise<any> {
  try {
    const pipeline = await prisma.pipeline.create({
      data: {
        name: data.name,
        description: data.description,
        actionType: data.actionType as any,
        config: data.config || undefined,
      },
    });

    logger.info('Pipeline created successfully', {
      pipeline_id: pipeline.id,
      name: pipeline.name,
      actionType: pipeline.actionType,
    });

    return pipeline;
  } catch (error) {
    logger.error('Failed to create pipeline', {
      error: error instanceof Error ? error.message : String(error),
      name: data.name,
    });
    throw error;
  }
}

/**
 * Get all pipelines with their subscribers
 */
export async function getAllPipelines(): Promise<any[]> {
  try {
    const pipelines = await prisma.pipeline.findMany({
      include: {
        subscribers: {
          select: {
            id: true,
            targetUrl: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    logger.debug('Retrieved all pipelines', {
      count: pipelines.length,
    });

    return pipelines;
  } catch (error) {
    logger.error('Failed to retrieve pipelines', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get pipeline by ID with subscribers
 */
export async function getPipelineById(pipelineId: string): Promise<any> {
  try {
    const pipeline = await prisma.pipeline.findUnique({
      where: { id: pipelineId },
      include: {
        subscribers: {
          select: {
            id: true,
            targetUrl: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    logger.debug('Retrieved pipeline by ID', {
      pipeline_id: pipelineId,
      found: !!pipeline,
    });

    return pipeline;
  } catch (error) {
    logger.error('Failed to retrieve pipeline', {
      error: error instanceof Error ? error.message : String(error),
      pipeline_id: pipelineId,
    });
    throw error;
  }
}

/**
 * Add a subscriber to a pipeline
 */
export async function addSubscriber(
  pipelineId: string,
  data: AddSubscriberDTO
): Promise<any> {
  try {
    // Check if pipeline exists
    const pipeline = await prisma.pipeline.findUnique({
      where: { id: pipelineId },
    });

    if (!pipeline) {
      logger.warn('Pipeline not found for subscriber addition', {
        pipeline_id: pipelineId,
      });
      throw new Error(`Pipeline with id ${pipelineId} not found`);
    }

    // Create subscriber
    const subscriber = await prisma.subscriber.create({
      data: {
        pipelineId,
        targetUrl: data.targetUrl,
      },
    });

    logger.info('Subscriber added successfully', {
      subscriber_id: subscriber.id,
      pipeline_id: pipelineId,
      target_url: subscriber.targetUrl,
    });

    return subscriber;
  } catch (error) {
    logger.error('Failed to add subscriber', {
      error: error instanceof Error ? error.message : String(error),
      pipeline_id: pipelineId,
      target_url: data.targetUrl,
    });
    throw error;
  }
}

/**
 * Update a pipeline
 */
export async function updatePipeline(
  pipelineId: string,
  data: Partial<CreatePipelineDTO>
): Promise<any> {
  try {
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.actionType !== undefined) updateData.actionType = data.actionType;
    if (data.config !== undefined) updateData.config = data.config;

    const pipeline = await prisma.pipeline.update({
      where: { id: pipelineId },
      data: updateData,
    });

    logger.info('Pipeline updated successfully', {
      pipeline_id: pipelineId,
      name: pipeline.name,
    });

    return pipeline;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        logger.warn('Pipeline not found for update', {
          pipeline_id: pipelineId,
        });
      }
    }
    logger.error('Failed to update pipeline', {
      error: error instanceof Error ? error.message : String(error),
      pipeline_id: pipelineId,
    });
    throw error;
  }
}

/**
 * Update pipeline action toggles only
 */
export async function updatePipelineActions(
  pipelineId: string,
  data: UpdatePipelineActionsDTO
): Promise<any> {
  try {
    const updateData: Record<string, unknown> = {};

    if (data.enabledActions !== undefined) {
      const normalized = data.enabledActions
        .filter((action) => typeof action === 'string' && action.trim().length > 0)
        .map((action) => action.trim().toUpperCase());

      updateData.enabledActions = Array.from(new Set(normalized));
    }

    if (data.emailEnabled !== undefined) {
      updateData.emailEnabled = data.emailEnabled;
    }

    if (data.discordEnabled !== undefined) {
      updateData.discordEnabled = data.discordEnabled;
    }

    const pipeline = await prisma.pipeline.update({
      where: { id: pipelineId },
      data: updateData,
    });

    logger.info('Pipeline actions updated successfully', {
      pipeline_id: pipelineId,
      enabledActions: pipeline.enabledActions,
      emailEnabled: pipeline.emailEnabled,
      discordEnabled: pipeline.discordEnabled,
    });

    return pipeline;
  } catch (error) {
    logger.error('Failed to update pipeline actions', {
      error: error instanceof Error ? error.message : String(error),
      pipeline_id: pipelineId,
    });
    throw error;
  }
}

/**
 * Build per-action readiness checks for a pipeline
 */
export async function getPipelineHealth(pipelineId: string): Promise<PipelineHealthReport | null> {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
  });

  if (!pipeline) {
    return null;
  }

  const enabledActions = new Set((pipeline.enabledActions ?? []).map((action) => action.toUpperCase()));
  const checks: ActionReadinessItem[] = [];

  const converterEnabled = enabledActions.has('CONVERTER');
  checks.push({
    action: 'CONVERTER',
    enabled: converterEnabled,
    status: converterEnabled ? 'ready' : 'disabled',
    details: converterEnabled
      ? 'Converter action is enabled and handled internally.'
      : 'Disabled by pipeline flags (enabledActions).',
  });

  const pdfEnabled = enabledActions.has('PDF');
  checks.push({
    action: 'PDF',
    enabled: pdfEnabled,
    status: pdfEnabled ? 'ready' : 'disabled',
    details: pdfEnabled
      ? 'PDF action is enabled and generated internally.'
      : 'Disabled by pipeline flags (enabledActions).',
  });

  const discordActionEnabled = pipeline.discordEnabled && enabledActions.has('DISCORD');
  if (!discordActionEnabled) {
    checks.push({
      action: 'DISCORD',
      enabled: false,
      status: 'disabled',
      details: 'Disabled by pipeline flags (enabledActions/discordEnabled).',
    });
  } else {
    const url = process.env.DISCORD_WEBHOOK_URL;
    if (!url || url.trim() === '') {
      checks.push({
        action: 'DISCORD',
        enabled: true,
        status: 'failed',
        details: 'DISCORD_WEBHOOK_URL is missing.',
      });
    } else {
      try {
        const response = await fetch(url, { method: 'GET' });
        checks.push({
          action: 'DISCORD',
          enabled: true,
          status: response.ok ? 'ready' : 'failed',
          details: response.ok
            ? 'Discord webhook is reachable.'
            : `Discord webhook returned HTTP ${response.status}.`,
        });
      } catch (error) {
        checks.push({
          action: 'DISCORD',
          enabled: true,
          status: 'failed',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const emailActionEnabled = pipeline.emailEnabled && enabledActions.has('EMAIL');
  if (!emailActionEnabled) {
    checks.push({
      action: 'EMAIL',
      enabled: false,
      status: 'disabled',
      details: 'Disabled by pipeline flags (enabledActions/emailEnabled).',
    });
  } else {
    try {
      const transporter = (await import('../../services/email.service.js')).emailService;
      await transporter.verifyConnection();
      checks.push({
        action: 'EMAIL',
        enabled: true,
        status: 'ready',
        details: 'SMTP transporter verify() succeeded.',
      });
    } catch (error) {
      checks.push({
        action: 'EMAIL',
        enabled: true,
        status: 'failed',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const aiActionEnabled = enabledActions.has('AI_SUMMARIZER');
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!aiActionEnabled) {
    checks.push({
      action: 'AI_SUMMARIZER',
      enabled: false,
      status: 'disabled',
      details: 'Disabled by pipeline flags (enabledActions).',
    });
  } else if (!geminiApiKey || geminiApiKey.trim() === '') {
    checks.push({
      action: 'AI_SUMMARIZER',
      enabled: true,
      status: 'failed',
      details: 'GEMINI_API_KEY is missing.',
    });
  } else {
    checks.push({
      action: 'AI_SUMMARIZER',
      enabled: true,
      status: 'ready',
      details: 'Gemini API key is present.',
    });
  }

  return {
    pipelineId,
    generatedAt: new Date().toISOString(),
    checks,
  };
}

/**
 * Delete a pipeline
 */
export async function deletePipeline(pipelineId: string): Promise<void> {
  try {
    await prisma.pipeline.delete({
      where: { id: pipelineId },
    });

    logger.info('Pipeline deleted successfully', {
      pipeline_id: pipelineId,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        logger.warn('Pipeline not found for deletion', {
          pipeline_id: pipelineId,
        });
      }
    }
    logger.error('Failed to delete pipeline', {
      error: error instanceof Error ? error.message : String(error),
      pipeline_id: pipelineId,
    });
    throw error;
  }
}

/**
 * Get all subscribers for a pipeline
 */
export async function getSubscribersByPipelineId(
  pipelineId: string
): Promise<any[]> {
  try {
    const subscribers = await prisma.subscriber.findMany({
      where: { pipelineId },
      select: {
        id: true,
        targetUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    logger.debug('Retrieved subscribers for pipeline', {
      pipeline_id: pipelineId,
      count: subscribers.length,
    });

    return subscribers;
  } catch (error) {
    logger.error('Failed to retrieve subscribers', {
      error: error instanceof Error ? error.message : String(error),
      pipeline_id: pipelineId,
    });
    throw error;
  }
}
