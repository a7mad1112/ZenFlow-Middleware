import { PrismaClient, ActionType, Prisma } from '@prisma/client';
import { logger } from '../../shared/logger.js';

const prisma = new PrismaClient();

export interface CreatePipelineDTO {
  name: string;
  description?: string;
  actionType: ActionType;
  config?: Prisma.JsonValue;
}

export interface AddSubscriberDTO {
  targetUrl: string;
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
        actionType: data.actionType,
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
