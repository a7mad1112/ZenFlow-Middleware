import { PrismaClient, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export type RiskLevel = 'Low' | 'Medium' | 'High';

function extractRiskLevelFromResult(result: unknown): RiskLevel | null {
  if (!result) {
    return null;
  }

  if (typeof result === 'object' && !Array.isArray(result)) {
    const obj = result as Record<string, unknown>;

    if (typeof obj.riskLevel === 'string') {
      const normalized = obj.riskLevel.toLowerCase();
      if (normalized === 'low') return 'Low';
      if (normalized === 'medium') return 'Medium';
      if (normalized === 'high') return 'High';
    }

    if (typeof obj.aiSummary === 'string') {
      const match = obj.aiSummary.match(/Risk:\s*(Low|Medium|High)/i);
      if (match) {
        const normalized = match[1].toLowerCase();
        if (normalized === 'low') return 'Low';
        if (normalized === 'medium') return 'Medium';
        if (normalized === 'high') return 'High';
      }
    }
  }

  if (typeof result === 'string') {
    const match = result.match(/Risk:\s*(Low|Medium|High)/i);
    if (match) {
      const normalized = match[1].toLowerCase();
      if (normalized === 'low') return 'Low';
      if (normalized === 'medium') return 'Medium';
      if (normalized === 'high') return 'High';
    }
  }

  return null;
}

export async function getDashboardStats(): Promise<{
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
}> {
  const [totalTasks, groupedStatuses, tasksForRisk] = await Promise.all([
    prisma.task.count(),
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
  ]);

  const statusCounts = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  for (const row of groupedStatuses) {
    const status = row.status.toLowerCase();
    if (status === 'pending') statusCounts.pending = row._count.status;
    if (status === 'processing') statusCounts.processing = row._count.status;
    if (status === 'completed') statusCounts.completed = row._count.status;
    if (status === 'failed') statusCounts.failed = row._count.status;
  }

  const riskDistribution = {
    Low: 0,
    Medium: 0,
    High: 0,
  };

  for (const task of tasksForRisk) {
    const risk = extractRiskLevelFromResult(task.result);
    if (risk) {
      riskDistribution[risk] += 1;
    }
  }

  const successRate =
    totalTasks === 0 ? 0 : Number(((statusCounts.completed / totalTasks) * 100).toFixed(2));

  return {
    totalTasks,
    successRate,
    statusCounts,
    riskDistribution,
  };
}

export async function getDashboardLogs(params: {
  page: number;
  limit: number;
  status?: string;
  pipelineId?: string;
  riskLevel?: RiskLevel;
}): Promise<{
  data: Array<Record<string, unknown>>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const { page, limit, status, pipelineId, riskLevel } = params;

  const where: Prisma.TaskWhereInput = {};
  if (status) {
    where.status = status;
  }
  if (pipelineId) {
    where.pipelineId = pipelineId;
  }

  const skip = (page - 1) * limit;

  if (!riskLevel) {
    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        include: {
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
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
    ]);

    const mapped = tasks.map((task) => {
      const taskRisk = extractRiskLevelFromResult(task.result);
      return {
        ...task,
        riskLevel: taskRisk,
      };
    });

    return {
      data: mapped,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  // Risk filter fallback: parse risk from result payload on the fly.
  const tasks = await prisma.task.findMany({
    where,
    include: {
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
    orderBy: {
      createdAt: 'desc',
    },
  });

  const filtered = tasks
    .map((task) => ({
      ...task,
      riskLevel: extractRiskLevelFromResult(task.result),
    }))
    .filter((task) => task.riskLevel === riskLevel);

  const paged = filtered.slice(skip, skip + limit);

  return {
    data: paged,
    pagination: {
      page,
      limit,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
    },
  };
}

export async function getDashboardLogDetail(id: string): Promise<Record<string, unknown> | null> {
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      pipeline: true,
      webhook: true,
    },
  });

  if (!task) {
    return null;
  }

  const riskLevel = extractRiskLevelFromResult(task.result);

  return {
    ...task,
    riskLevel,
  };
}
