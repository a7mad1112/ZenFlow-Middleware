import { apiClient } from '../api/client';

export type LogStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type RiskLevel = 'Low' | 'Medium' | 'High' | null;

export interface LogListItem {
  id: string;
  status: string;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  pipelineId?: string;
  riskLevel: RiskLevel;
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
  riskLevel?: Exclude<RiskLevel, null>;
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
  status: string;
  attempts: number;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  payload?: unknown;
  result?: unknown;
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

function normalizeRiskLevel(value: unknown): RiskLevel {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.toLowerCase();
  if (normalized === 'low') return 'Low';
  if (normalized === 'medium') return 'Medium';
  if (normalized === 'high') return 'High';
  return null;
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

function normalizeLogListItem(item: Partial<LogListItem>): LogListItem {
  return {
    id: String(item.id ?? ''),
    status: normalizeStatus(item.status),
    attempts: Number(item.attempts ?? 0),
    createdAt: String(item.createdAt ?? new Date(0).toISOString()),
    updatedAt: String(item.updatedAt ?? new Date(0).toISOString()),
    pipelineId: item.pipelineId,
    riskLevel: normalizeRiskLevel(item.riskLevel),
    pipeline: item.pipeline ?? null,
    webhook: item.webhook ?? null,
  };
}

function normalizeLogDetail(item: Partial<LogDetail>): LogDetail {
  return {
    id: String(item.id ?? ''),
    status: normalizeStatus(item.status),
    attempts: Number(item.attempts ?? 0),
    error: item.error ?? null,
    createdAt: String(item.createdAt ?? new Date(0).toISOString()),
    updatedAt: String(item.updatedAt ?? new Date(0).toISOString()),
    completedAt: item.completedAt ?? null,
    payload: item.payload,
    result: item.result,
    pipeline: item.pipeline ?? null,
    webhook: item.webhook ?? null,
    riskLevel: normalizeRiskLevel(item.riskLevel),
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
