import { PrismaClient, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export type RiskLevel = 'Low' | 'Medium' | 'High';
export type TaskOrigin = 'MANUAL' | 'WEBHOOK';

type NormalizedResult = {
  xml: string | null;
  xmlOutput: string | null;
  aiSummary: string | null;
  actions: {
    xml: 'success' | 'failed' | 'pending' | 'skipped';
    ai: 'success' | 'failed' | 'pending' | 'skipped';
    discord: 'success' | 'failed' | 'pending' | 'skipped';
    pdf: 'success' | 'failed' | 'pending' | 'skipped';
    email: 'success' | 'failed' | 'pending' | 'skipped';
  };
  pdfInfo: {
    generated: boolean;
    sizeBytes: number | null;
    path: string | null;
    error: string | null;
    contentBase64: string | null;
  };
  email: {
    status: string | null;
    attempted: boolean;
    sent: boolean;
    to: string | null;
    error: string | null;
  };
  discord: {
    status: string | null;
    attempted: boolean;
    sent: boolean;
    error: string | null;
  };
  raw: unknown;
};

function normalizeActionState(value: unknown): 'success' | 'failed' | 'pending' | 'skipped' {
  if (typeof value !== 'string') {
    return 'pending';
  }

  const normalized = value.toLowerCase();
  if (normalized === 'success') return 'success';
  if (normalized === 'failed') return 'failed';
  if (normalized === 'skipped') return 'skipped';
  return 'pending';
}

function normalizeResultForDashboard(result: unknown): NormalizedResult {
  if (typeof result === 'string') {
    return {
      xml: result,
      xmlOutput: result,
      aiSummary: null,
      actions: {
        xml: 'success',
        ai: 'pending',
        discord: 'pending',
        pdf: 'pending',
        email: 'pending',
      },
      pdfInfo: {
        generated: false,
        sizeBytes: null,
        path: null,
        error: null,
        contentBase64: null,
      },
      email: {
        status: null,
        attempted: false,
        sent: false,
        to: null,
        error: null,
      },
      discord: {
        status: null,
        attempted: false,
        sent: false,
        error: null,
      },
      raw: result,
    };
  }

  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const obj = result as Record<string, unknown>;
    const pdfObj =
      obj.pdf && typeof obj.pdf === 'object' && !Array.isArray(obj.pdf)
        ? (obj.pdf as Record<string, unknown>)
        : null;

    const sizeBytes =
      typeof pdfObj?.sizeBytes === 'number'
        ? pdfObj.sizeBytes
        : typeof pdfObj?.size === 'number'
          ? pdfObj.size
          : null;

    const actionsObj =
      obj.actions && typeof obj.actions === 'object' && !Array.isArray(obj.actions)
        ? (obj.actions as Record<string, unknown>)
        : null;

    const emailObj =
      obj.email && typeof obj.email === 'object' && !Array.isArray(obj.email)
        ? (obj.email as Record<string, unknown>)
        : null;

    const discordObj =
      obj.discord && typeof obj.discord === 'object' && !Array.isArray(obj.discord)
        ? (obj.discord as Record<string, unknown>)
        : null;

    const normalized: NormalizedResult = {
      xml: typeof obj.xml === 'string' ? obj.xml : null,
      xmlOutput: typeof obj.xmlOutput === 'string' ? obj.xmlOutput : typeof obj.xml === 'string' ? obj.xml : null,
      aiSummary: typeof obj.aiSummary === 'string' ? obj.aiSummary : null,
      actions: {
        xml: normalizeActionState(actionsObj?.xml),
        ai: normalizeActionState(actionsObj?.ai),
        discord: normalizeActionState(actionsObj?.discord),
        pdf: normalizeActionState(actionsObj?.pdf),
        email: normalizeActionState(actionsObj?.email),
      },
      pdfInfo: {
        generated: Boolean(pdfObj?.generated || sizeBytes),
        sizeBytes,
        path:
          typeof pdfObj?.path === 'string'
            ? pdfObj.path
            : typeof pdfObj?.url === 'string'
              ? pdfObj.url
              : null,
        error: typeof pdfObj?.error === 'string' ? pdfObj.error : null,
        contentBase64: typeof pdfObj?.contentBase64 === 'string' ? pdfObj.contentBase64 : null,
      },
      email: {
        status: typeof emailObj?.status === 'string' ? emailObj.status : null,
        attempted: Boolean(emailObj?.attempted),
        sent: Boolean(emailObj?.sent),
        to: typeof emailObj?.to === 'string' ? emailObj.to : null,
        error: typeof emailObj?.error === 'string' ? emailObj.error : null,
      },
      discord: {
        status: typeof discordObj?.status === 'string' ? discordObj.status : null,
        attempted: Boolean(discordObj?.attempted),
        sent: Boolean(discordObj?.sent),
        error: typeof discordObj?.error === 'string' ? discordObj.error : null,
      },
      raw: result,
    };

    return normalized;
  }

  return {
    xml: null,
    xmlOutput: null,
    aiSummary: null,
    actions: {
      xml: 'pending',
      ai: 'pending',
      discord: 'pending',
      pdf: 'pending',
      email: 'pending',
    },
    pdfInfo: {
      generated: false,
      sizeBytes: null,
      path: null,
      error: null,
      contentBase64: null,
    },
    email: {
      status: null,
      attempted: false,
      sent: false,
      to: null,
      error: null,
    },
    discord: {
      status: null,
      attempted: false,
      sent: false,
      error: null,
    },
    raw: result,
  };
}

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

function extractTaskOrigin(result: unknown, payload: unknown): TaskOrigin {
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const obj = result as Record<string, unknown>;
    if (typeof obj.origin === 'string' && obj.origin.trim() !== '') {
      const normalized = obj.origin.trim().toUpperCase();
      if (normalized === 'MANUAL') return 'MANUAL';
      if (normalized === 'WEBHOOK') return 'WEBHOOK';
    }
  }

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const payloadObj = payload as Record<string, unknown>;
    if (payloadObj.metadata && typeof payloadObj.metadata === 'object' && !Array.isArray(payloadObj.metadata)) {
      const meta = payloadObj.metadata as Record<string, unknown>;
      if (typeof meta.origin === 'string' && meta.origin.trim() !== '') {
        const normalized = meta.origin.trim().toUpperCase();
        if (normalized === 'MANUAL') return 'MANUAL';
        if (normalized === 'WEBHOOK') return 'WEBHOOK';
      }
    }
  }

  return 'WEBHOOK';
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
      const normalizedResult = normalizeResultForDashboard(task.result);
      return {
        ...task,
        result: normalizedResult,
        aiSummary: normalizedResult.aiSummary,
        actions: normalizedResult.actions,
        origin: extractTaskOrigin(task.result, task.payload),
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
    .map((task) => {
      const normalizedResult = normalizeResultForDashboard(task.result);
      return {
        ...task,
        result: normalizedResult,
        aiSummary: normalizedResult.aiSummary,
        actions: normalizedResult.actions,
        origin: extractTaskOrigin(task.result, task.payload),
        riskLevel: extractRiskLevelFromResult(task.result),
      };
    })
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

  const normalizedResult = normalizeResultForDashboard(task.result);

  return {
    ...task,
    result: normalizedResult,
    aiSummary: normalizedResult.aiSummary,
    actions: normalizedResult.actions,
    origin: extractTaskOrigin(task.result, task.payload),
    riskLevel,
  };
}
