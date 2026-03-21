import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type RiskLevel = 'Low' | 'Medium' | 'High';

export interface AssistantSnapshot {
  generatedAt: string;
  derived: {
    healthScore: number;
    failedTasks: number;
    completedTasks: number;
    latestFailure: {
      taskId: string;
      error: string;
      createdAt: string;
      pipelineName: string | null;
    } | null;
  };
  systemStats: {
    totalTasks: number;
    successRate: number;
    statusCounts: {
      pending: number;
      processing: number;
      completed: number;
      failed: number;
    };
    riskDistribution: {
      Low: number;
      Medium: number;
      High: number;
    };
  };
  pipelineStates: Array<{
    id: string;
    name: string;
    isActive: boolean;
    actionType: string;
    enabledActions: string[];
    emailEnabled: boolean;
    discordEnabled: boolean;
    updatedAt: string;
    taskCounts: {
      total: number;
      pending: number;
      processing: number;
      completed: number;
      failed: number;
    };
  }>;
  recentLogs: Array<{
    id: string;
    status: string;
    attempts: number;
    error: string | null;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    pipeline: {
      id: string;
      name: string;
    } | null;
    webhook: {
      id: string;
      eventType: string;
    } | null;
    riskLevel: RiskLevel | null;
    aiSummary: string | null;
  }>;
}

function extractRiskLevel(result: unknown): RiskLevel | null {
  if (!result) {
    return null;
  }

  if (typeof result === 'string') {
    const match = result.match(/Risk:\s*(Low|Medium|High)/i);
    if (!match) {
      return null;
    }

    const normalized = match[1].toLowerCase();
    if (normalized === 'low') return 'Low';
    if (normalized === 'medium') return 'Medium';
    return 'High';
  }

  if (typeof result === 'object' && !Array.isArray(result)) {
    const value = result as Record<string, unknown>;

    if (typeof value.riskLevel === 'string') {
      const normalized = value.riskLevel.toLowerCase();
      if (normalized === 'low') return 'Low';
      if (normalized === 'medium') return 'Medium';
      if (normalized === 'high') return 'High';
    }

    if (typeof value.aiSummary === 'string') {
      return extractRiskLevel(value.aiSummary);
    }
  }

  return null;
}

function extractAiSummary(result: unknown): string | null {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return null;
  }

  const value = result as Record<string, unknown>;
  return typeof value.aiSummary === 'string' ? value.aiSummary : null;
}

export async function buildAssistantSnapshot(): Promise<AssistantSnapshot> {
  const [groupedStatuses, tasksForRisk, pipelines, pipelineTaskGroups, recentLogs, latestFailedTask] = await Promise.all([
    prisma.task.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    }),
    prisma.task.findMany({
      select: {
        result: true,
      },
    }),
    prisma.pipeline.findMany({
      select: {
        id: true,
        name: true,
        isActive: true,
        actionType: true,
        enabledActions: true,
        emailEnabled: true,
        discordEnabled: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    }),
    prisma.task.groupBy({
      by: ['pipelineId', 'status'],
      _count: {
        status: true,
      },
    }),
    prisma.task.findMany({
      take: 20,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        status: true,
        attempts: true,
        error: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        result: true,
        pipeline: {
          select: {
            id: true,
            name: true,
          },
        },
        webhook: {
          select: {
            id: true,
            eventType: true,
          },
        },
      },
    }),
    prisma.task.findFirst({
      where: {
        status: {
          equals: 'failed',
          mode: 'insensitive',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        error: true,
        createdAt: true,
        pipeline: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  const statusCounts = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  for (const row of groupedStatuses) {
    const normalized = row.status.toLowerCase();
    if (normalized === 'pending') statusCounts.pending = row._count.status;
    if (normalized === 'processing') statusCounts.processing = row._count.status;
    if (normalized === 'completed') statusCounts.completed = row._count.status;
    if (normalized === 'failed') statusCounts.failed = row._count.status;
  }

  const riskDistribution = {
    Low: 0,
    Medium: 0,
    High: 0,
  };

  for (const task of tasksForRisk) {
    const risk = extractRiskLevel(task.result);
    if (risk) {
      riskDistribution[risk] += 1;
    }
  }

  const totalTasks =
    statusCounts.pending + statusCounts.processing + statusCounts.completed + statusCounts.failed;

  const successRate =
    totalTasks === 0 ? 0 : Number(((statusCounts.completed / totalTasks) * 100).toFixed(2));

  const healthScore = Number(Math.max(0, Math.min(100, successRate)).toFixed(2));

  const taskGroupMap = new Map<
    string,
    {
      pending: number;
      processing: number;
      completed: number;
      failed: number;
    }
  >();

  for (const row of pipelineTaskGroups) {
    const existing = taskGroupMap.get(row.pipelineId) ?? {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    const normalized = row.status.toLowerCase();
    if (normalized === 'pending') existing.pending = row._count.status;
    if (normalized === 'processing') existing.processing = row._count.status;
    if (normalized === 'completed') existing.completed = row._count.status;
    if (normalized === 'failed') existing.failed = row._count.status;

    taskGroupMap.set(row.pipelineId, existing);
  }

  const pipelineStates = pipelines.map((pipeline) => {
    const grouped = taskGroupMap.get(pipeline.id) ?? {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    return {
      id: pipeline.id,
      name: pipeline.name,
      isActive: pipeline.isActive,
      actionType: pipeline.actionType,
      enabledActions: pipeline.enabledActions,
      emailEnabled: pipeline.emailEnabled,
      discordEnabled: pipeline.discordEnabled,
      updatedAt: pipeline.updatedAt.toISOString(),
      taskCounts: {
        total: grouped.pending + grouped.processing + grouped.completed + grouped.failed,
        pending: grouped.pending,
        processing: grouped.processing,
        completed: grouped.completed,
        failed: grouped.failed,
      },
    };
  });

  const formattedLogs = recentLogs.map((log) => ({
    id: log.id,
    status: log.status,
    attempts: log.attempts,
    error: log.error,
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
    completedAt: log.completedAt ? log.completedAt.toISOString() : null,
    pipeline: log.pipeline,
    webhook: log.webhook,
    riskLevel: extractRiskLevel(log.result),
    aiSummary: extractAiSummary(log.result),
  }));

  return {
    generatedAt: new Date().toISOString(),
    derived: {
      healthScore,
      failedTasks: statusCounts.failed,
      completedTasks: statusCounts.completed,
      latestFailure:
        latestFailedTask && typeof latestFailedTask.error === 'string' && latestFailedTask.error.trim()
          ? {
              taskId: latestFailedTask.id,
              error: latestFailedTask.error,
              createdAt: latestFailedTask.createdAt.toISOString(),
              pipelineName: latestFailedTask.pipeline?.name ?? null,
            }
          : null,
    },
    systemStats: {
      totalTasks,
      successRate,
      statusCounts,
      riskDistribution,
    },
    pipelineStates,
    recentLogs: formattedLogs,
  };
}
