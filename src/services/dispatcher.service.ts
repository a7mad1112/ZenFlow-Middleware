import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { logger } from '../shared/logger.js';

const prisma = new PrismaClient();

type UnifiedResultPayload = {
  taskId: string;
  origin: 'MANUAL' | 'WEBHOOK';
  eventType: string | null;
  xmlOutput: string | null;
  aiSummary: string | null;
  pdfUrl: string | null;
  combinedResults: {
    xml: string | null;
    ai: string | null;
    pdf: string | null;
  };
  originalPayload: Record<string, unknown>;
  timestamp: string;
};

type ActionExecutionState = 'success' | 'failed' | 'pending' | 'skipped';

function normalizeActionState(value: unknown): ActionExecutionState {
  if (typeof value !== 'string') {
    return 'pending';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'success') return 'success';
  if (normalized === 'failed') return 'failed';
  if (normalized === 'skipped') return 'skipped';
  return 'pending';
}

function extractEventTypeFromPayload(payload: Record<string, unknown>): string | null {
  const candidate = payload.eventType ?? payload.type ?? payload.event;
  if (typeof candidate !== 'string' || candidate.trim() === '') {
    return null;
  }

  return candidate.trim();
}

function extractOrigin(result: unknown, payload: Record<string, unknown>): 'MANUAL' | 'WEBHOOK' {
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const obj = result as Record<string, unknown>;
    if (typeof obj.origin === 'string' && obj.origin.trim().toUpperCase() === 'MANUAL') {
      return 'MANUAL';
    }
  }

  const metadata = payload.metadata;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const origin = (metadata as Record<string, unknown>).origin;
    if (typeof origin === 'string' && origin.trim().toUpperCase() === 'MANUAL') {
      return 'MANUAL';
    }
  }

  return 'WEBHOOK';
}

function normalizeTaskResult(result: unknown): {
  xmlOutput: string | null;
  aiSummary: string | null;
  pdfUrl: string | null;
} {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    if (typeof result === 'string') {
      return {
        xmlOutput: result,
        aiSummary: null,
        pdfUrl: null,
      };
    }

    return {
      xmlOutput: null,
      aiSummary: null,
      pdfUrl: null,
    };
  }

  const obj = result as Record<string, unknown>;
  const pdfObj =
    obj.pdf && typeof obj.pdf === 'object' && !Array.isArray(obj.pdf)
      ? (obj.pdf as Record<string, unknown>)
      : null;

  const derivedPdfUrl =
    typeof obj.pdfUrl === 'string'
      ? obj.pdfUrl
      : typeof pdfObj?.url === 'string'
        ? pdfObj.url
        : null;

  return {
    xmlOutput:
      typeof obj.xmlOutput === 'string'
        ? obj.xmlOutput
        : typeof obj.xml === 'string'
          ? obj.xml
          : null,
    aiSummary: typeof obj.aiSummary === 'string' ? obj.aiSummary : null,
    pdfUrl: derivedPdfUrl,
  };
}

function canDispatchToSubscribers(result: unknown): { allowed: boolean; reason?: string } {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return {
      allowed: false,
      reason: 'Result is not structured yet',
    };
  }

  const obj = result as Record<string, unknown>;
  const actionsObj =
    obj.actions && typeof obj.actions === 'object' && !Array.isArray(obj.actions)
      ? (obj.actions as Record<string, unknown>)
      : null;

  if (!actionsObj) {
    return {
      allowed: false,
      reason: 'Missing action execution map',
    };
  }

  const xmlState = normalizeActionState(actionsObj.xml);
  const aiState = normalizeActionState(actionsObj.ai);
  const pdfState = normalizeActionState(actionsObj.pdf);

  const coreActions: Array<{ key: 'xml' | 'ai' | 'pdf'; state: ActionExecutionState }> = [
    { key: 'xml', state: xmlState },
    { key: 'ai', state: aiState },
    { key: 'pdf', state: pdfState },
  ];

  const activeCoreActions = coreActions.filter((action) => action.state !== 'skipped');

  if (activeCoreActions.length === 0) {
    return {
      allowed: false,
      reason: 'No active XML/AI/PDF actions in this run',
    };
  }

  const failedOrPending = activeCoreActions.find((action) => action.state !== 'success');
  if (failedOrPending) {
    return {
      allowed: false,
      reason: `Core action ${failedOrPending.key} is ${failedOrPending.state}`,
    };
  }

  const normalized = normalizeTaskResult(result);

  const missingPayload = activeCoreActions.find((action) => {
    if (action.key === 'xml') return !normalized.xmlOutput;
    if (action.key === 'ai') return !normalized.aiSummary;
    return !normalized.pdfUrl;
  });

  if (missingPayload) {
    return {
      allowed: false,
      reason: `Core action ${missingPayload.key} missing output payload`,
    };
  }

  return { allowed: true };
}

function toResponseBodyText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return value.length > 2000 ? `${value.slice(0, 2000)}...` : value;
  }

  try {
    const text = JSON.stringify(value);
    if (!text) {
      return null;
    }
    return text.length > 2000 ? `${text.slice(0, 2000)}...` : text;
  } catch {
    return String(value);
  }
}

export async function dispatchUnifiedResult(taskId: string, pipelineId: string): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      payload: true,
      result: true,
      webhook: {
        select: {
          eventType: true,
        },
      },
    },
  });

  if (!task) {
    logger.warn('Dispatcher skipped: task not found', { taskId, pipelineId });
    return;
  }

  const payload =
    task.payload && typeof task.payload === 'object' && !Array.isArray(task.payload)
      ? (task.payload as Record<string, unknown>)
      : {};

  const dispatchGuard = canDispatchToSubscribers(task.result);
  if (!dispatchGuard.allowed) {
    logger.info('Dispatcher skipped: core actions are not fully completed', {
      taskId,
      pipelineId,
      reason: dispatchGuard.reason,
    });
    return;
  }

  const normalizedResult = normalizeTaskResult(task.result);
  const unifiedResult: UnifiedResultPayload = {
    taskId,
    origin: extractOrigin(task.result, payload),
    eventType: extractEventTypeFromPayload(payload) ?? task.webhook?.eventType ?? null,
    xmlOutput: normalizedResult.xmlOutput,
    aiSummary: normalizedResult.aiSummary,
    pdfUrl: normalizedResult.pdfUrl,
    combinedResults: {
      xml: normalizedResult.xmlOutput,
      ai: normalizedResult.aiSummary,
      pdf: normalizedResult.pdfUrl,
    },
    originalPayload: payload,
    timestamp: new Date().toISOString(),
  };

  const subscribers = await prisma.subscriber.findMany({
    where: {
      pipelineId,
      isActive: true,
    },
    select: {
      id: true,
      targetUrl: true,
    },
  });

  if (subscribers.length === 0) {
    logger.debug('Dispatcher skipped: no active subscribers', { taskId, pipelineId });
    return;
  }

  await Promise.all(
    subscribers.map(async (subscriber) => {
      const startedAt = Date.now();
      try {
        const response = await axios.post(subscriber.targetUrl, unifiedResult, {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json',
          },
          validateStatus: () => true,
        });

        await prisma.deliveryLog.create({
          data: {
            subscriberId: subscriber.id,
            taskId,
            statusCode: response.status,
            responseBody: toResponseBodyText(response.data),
            durationMs: Date.now() - startedAt,
          },
        });
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        const statusCode = axios.isAxiosError(error) && error.response ? error.response.status : 0;
        const responseBody = axios.isAxiosError(error)
          ? toResponseBodyText(error.response?.data ?? error.message)
          : toResponseBodyText(error instanceof Error ? error.message : String(error));

        await prisma.deliveryLog.create({
          data: {
            subscriberId: subscriber.id,
            taskId,
            statusCode,
            responseBody,
            durationMs,
          },
        });

        logger.warn('Outbound subscriber dispatch failed', {
          taskId,
          pipelineId,
          subscriberId: subscriber.id,
          targetUrl: subscriber.targetUrl,
          statusCode,
          durationMs,
        });
      }
    })
  );
}
