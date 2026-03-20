import { apiClient } from '../api/client';

export type LogStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type RiskLevel = 'Low' | 'Medium' | 'High';
export type ActionState = 'success' | 'failed' | 'pending' | 'skipped';

export interface LogActions {
  xml: ActionState;
  ai: ActionState;
  discord: ActionState;
  pdf: ActionState;
  email: ActionState;
}

export interface LogListItem {
  id: string;
  status: LogStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  pipelineId?: string;
  riskLevel: RiskLevel;
  aiSummary: string | null;
  actions: LogActions;
  pipeline?: {
    id: string;
    name: string;
  } | null;
  webhook?: {
    id: string;
    eventType?: string | null;
  } | null;
}

export interface LogsQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  pipelineId?: string;
  riskLevel?: RiskLevel;
}

export interface LogsResponse {
  data: LogListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LogDetail {
  id: string;
  status: LogStatus;
  attempts: number;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  payload?: unknown;
  result?: unknown;
  aiSummary: string | null;
  actions: LogActions;
  pipeline?: {
    id: string;
    name: string;
  } | null;
  webhook?: {
    id: string;
    eventType?: string | null;
  } | null;
  riskLevel: RiskLevel;
}

interface ApiEnvelope<T> {
  success?: boolean;
  data: T;
  pagination?: LogsResponse['pagination'];
}

function parseRiskFromText(value: unknown): RiskLevel | null {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.match(/Risk:\s*(Low|Medium|High)/i);
  if (!match) {
    return null;
  }

  const normalized = match[1].toLowerCase();
  if (normalized === 'low') return 'Low';
  if (normalized === 'medium') return 'Medium';
  return 'High';
}

function normalizeRiskLevel(value: unknown, aiSummary?: unknown): RiskLevel {
  if (typeof value !== 'string') {
    return parseRiskFromText(aiSummary) ?? 'Low';
  }

  const normalized = value.toLowerCase();
  if (normalized === 'low') return 'Low';
  if (normalized === 'medium') return 'Medium';
  if (normalized === 'high') return 'High';
  return parseRiskFromText(aiSummary) ?? 'Low';
}

function normalizeStatus(value: unknown): LogStatus {
  if (typeof value !== 'string') {
    return 'pending';
  }

  const normalized = value.toLowerCase();
  if (normalized === 'failed') return 'failed';
  if (normalized === 'completed' || normalized === 'processed') return 'completed';
  if (normalized === 'processing') return 'processing';
  return 'pending';
}

function normalizeActionState(value: unknown): ActionState {
  if (typeof value !== 'string') {
    return 'pending';
  }

  const normalized = value.toLowerCase();
  if (normalized === 'success') return 'success';
  if (normalized === 'failed') return 'failed';
  if (normalized === 'skipped') return 'skipped';
  return 'pending';
}

function buildDefaultActions(status: LogStatus): LogActions {
  if (status === 'completed') {
    return {
      xml: 'success',
      ai: 'success',
      discord: 'success',
      pdf: 'success',
      email: 'success',
    };
  }

  if (status === 'failed') {
    return {
      xml: 'failed',
      ai: 'failed',
      discord: 'failed',
      pdf: 'failed',
      email: 'failed',
    };
  }

  return {
    xml: 'pending',
    ai: 'pending',
    discord: 'pending',
    pdf: 'pending',
    email: 'pending',
  };
}

function extractAiSummary(item: Partial<LogDetail>): string | null {
  if (typeof item.aiSummary === 'string' && item.aiSummary.trim() !== '') {
    return item.aiSummary;
  }

  if (item.result && typeof item.result === 'object' && !Array.isArray(item.result)) {
    const resultObj = item.result as Record<string, unknown>;
    if (typeof resultObj.aiSummary === 'string' && resultObj.aiSummary.trim() !== '') {
      return resultObj.aiSummary;
    }
  }

  return null;
}

function extractActions(item: Partial<LogDetail>, status: LogStatus): LogActions {
  const defaults = buildDefaultActions(status);

  if (item.actions && typeof item.actions === 'object' && !Array.isArray(item.actions)) {
    const actions = item.actions as unknown as Record<string, unknown>;
    return {
      xml: normalizeActionState(actions.xml),
      ai: normalizeActionState(actions.ai),
      discord: normalizeActionState(actions.discord),
      pdf: normalizeActionState(actions.pdf),
      email: normalizeActionState(actions.email),
    };
  }

  return defaults;
}

function normalizeLogListItem(item: Partial<LogListItem>): LogListItem {
  const status = normalizeStatus(item.status);
  const aiSummary = extractAiSummary(item as Partial<LogDetail>);

  return {
    id: String(item.id ?? ''),
    status,
    attempts: Number(item.attempts ?? 0),
    createdAt: String(item.createdAt ?? new Date(0).toISOString()),
    updatedAt: String(item.updatedAt ?? new Date(0).toISOString()),
    pipelineId: item.pipelineId,
    riskLevel: normalizeRiskLevel(item.riskLevel, aiSummary),
    aiSummary,
    actions: extractActions(item as Partial<LogDetail>, status),
    pipeline: item.pipeline ?? null,
    webhook: item.webhook ?? null,
  };
}

function normalizeLogDetail(item: Partial<LogDetail>): LogDetail {
  const status = normalizeStatus(item.status);
  const aiSummary = extractAiSummary(item);

  return {
    id: String(item.id ?? ''),
    status,
    attempts: Number(item.attempts ?? 0),
    error: item.error ?? null,
    createdAt: String(item.createdAt ?? new Date(0).toISOString()),
    updatedAt: String(item.updatedAt ?? new Date(0).toISOString()),
    completedAt: item.completedAt ?? null,
    payload: item.payload,
    result: item.result,
    aiSummary,
    actions: extractActions(item, status),
    pipeline: item.pipeline ?? null,
    webhook: item.webhook ?? null,
    riskLevel: normalizeRiskLevel(item.riskLevel, aiSummary),
  };
}

export async function getLogs(params: LogsQueryParams = {}): Promise<LogsResponse> {
  const response = await apiClient.get<ApiEnvelope<LogListItem[]>>('/api/logs', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 30,
      ...(params.status ? { status: params.status } : {}),
      ...(params.pipelineId ? { pipelineId: params.pipelineId } : {}),
      ...(params.riskLevel ? { riskLevel: params.riskLevel } : {}),
    },
  });

  const items = Array.isArray(response.data.data) ? response.data.data : [];

  return {
    data: items.map((item) => normalizeLogListItem(item)),
    pagination: response.data.pagination ?? {
      page: 1,
      limit: items.length,
      total: items.length,
      totalPages: 1,
    },
  };
}

export async function getLogById(id: string): Promise<LogDetail> {
  const response = await apiClient.get<ApiEnvelope<LogDetail>>(`/api/logs/${id}`);
  return normalizeLogDetail(response.data.data);
}
