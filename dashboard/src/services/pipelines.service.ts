import { apiClient } from '../api/client';

export type ActionType = 'CONVERTER' | 'EMAIL' | 'DISCORD' | 'PDF' | 'AI_SUMMARIZER';

export interface Pipeline {
  id: string;
  name: string;
  description?: string | null;
  actionType: ActionType;
  rateLimit: number;
  enabledActions: ActionType[];
  discordEnabled: boolean;
  emailEnabled: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineWebhook {
  id: string;
  pipelineId: string;
  eventType: string;
  url: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineSubscriber {
  id: string;
  targetUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePipelineInput {
  name: string;
  description?: string;
  actionType: ActionType;
  rateLimit?: number;
  enabledActions: ActionType[];
  discordEnabled: boolean;
  emailEnabled: boolean;
  config?: Record<string, unknown>;
}

export interface UpdatePipelineInput {
  name?: string;
  description?: string;
  actionType?: ActionType;
  rateLimit?: number;
  enabledActions?: ActionType[];
  discordEnabled?: boolean;
  emailEnabled?: boolean;
  isActive?: boolean;
}

export interface CreatePipelineWebhookInput {
  eventType: string;
  url: string;
  isActive?: boolean;
}

export interface CreatePipelineSubscriberInput {
  targetUrl: string;
}

export interface TriggerPipelineInput {
  payload: Record<string, unknown>;
  eventType?: string;
}

export interface TriggerPipelineResult {
  taskId: string;
  jobId: string;
  status: string;
  webhookId: string | null;
}

interface ApiEnvelope<T> {
  success?: boolean;
  data: T;
  message?: string;
}

const ACTION_KEYS: ActionType[] = ['CONVERTER', 'DISCORD', 'EMAIL', 'PDF', 'AI_SUMMARIZER'];

function normalizePipeline(input: Partial<Pipeline>): Pipeline {
  const enabled = Array.isArray(input.enabledActions)
    ? input.enabledActions.filter((item): item is ActionType => ACTION_KEYS.includes(item as ActionType))
    : [];

  return {
    id: String(input.id ?? ''),
    name: String(input.name ?? 'Unnamed Pipeline'),
    description: input.description ?? null,
    actionType: (ACTION_KEYS.includes(input.actionType as ActionType)
      ? (input.actionType as ActionType)
      : 'CONVERTER'),
    rateLimit:
      typeof input.rateLimit === 'number' && Number.isFinite(input.rateLimit)
        ? Math.max(1, Math.min(1000, Math.floor(input.rateLimit)))
        : 60,
    enabledActions: enabled,
    discordEnabled: Boolean(input.discordEnabled),
    emailEnabled: Boolean(input.emailEnabled),
    isActive: Boolean(input.isActive),
    createdAt: String(input.createdAt ?? new Date(0).toISOString()),
    updatedAt: String(input.updatedAt ?? new Date(0).toISOString()),
  };
}

function normalizeWebhook(input: Partial<PipelineWebhook>): PipelineWebhook {
  return {
    id: String(input.id ?? ''),
    pipelineId: String(input.pipelineId ?? ''),
    eventType: String(input.eventType ?? ''),
    url: String(input.url ?? ''),
    isActive: Boolean(input.isActive),
    createdAt: String(input.createdAt ?? new Date(0).toISOString()),
    updatedAt: String(input.updatedAt ?? new Date(0).toISOString()),
  };
}

function normalizeSubscriber(input: Partial<PipelineSubscriber>): PipelineSubscriber {
  return {
    id: String(input.id ?? ''),
    targetUrl: String(input.targetUrl ?? ''),
    isActive: Boolean(input.isActive),
    createdAt: String(input.createdAt ?? new Date(0).toISOString()),
    updatedAt: String(input.updatedAt ?? new Date(0).toISOString()),
  };
}

export async function getPipelines(): Promise<Pipeline[]> {
  const response = await apiClient.get<ApiEnvelope<Pipeline[]>>('/api/pipelines');
  const items = Array.isArray(response.data.data) ? response.data.data : [];
  return items.map((item) => normalizePipeline(item));
}

export async function createPipeline(data: CreatePipelineInput): Promise<Pipeline> {
  const response = await apiClient.post<ApiEnvelope<Pipeline>>('/api/pipelines', data);
  return normalizePipeline(response.data.data);
}

export async function updatePipeline(id: string, data: UpdatePipelineInput): Promise<Pipeline> {
  const response = await apiClient.patch<ApiEnvelope<Pipeline>>(`/api/pipelines/${id}`, data);
  return normalizePipeline(response.data.data);
}

export async function deletePipeline(id: string): Promise<void> {
  await apiClient.delete(`/api/pipelines/${id}`);
}

export async function toggleAction(
  pipelineId: string,
  actionName: ActionType,
  enabled: boolean,
): Promise<Pipeline> {
  const current = await apiClient.get<ApiEnvelope<Pipeline>>(`/api/pipelines/${pipelineId}`);
  const pipeline = normalizePipeline(current.data.data);

  const set = new Set<ActionType>(pipeline.enabledActions);
  if (enabled) {
    set.add(actionName);
  } else {
    set.delete(actionName);
  }

  const payload: UpdatePipelineInput = {
    enabledActions: Array.from(set),
  };

  if (actionName === 'DISCORD') {
    payload.discordEnabled = enabled;
  }

  if (actionName === 'EMAIL') {
    payload.emailEnabled = enabled;
  }

  const response = await apiClient.patch<ApiEnvelope<Pipeline>>(`/api/pipelines/${pipelineId}/actions`, payload);
  return normalizePipeline(response.data.data);
}

export async function getPipelineWebhooks(pipelineId: string): Promise<PipelineWebhook[]> {
  const response = await apiClient.get<ApiEnvelope<PipelineWebhook[]>>(`/api/pipelines/${pipelineId}/webhooks`);
  const items = Array.isArray(response.data.data) ? response.data.data : [];
  return items.map((item) => normalizeWebhook(item));
}

export async function createPipelineWebhook(
  pipelineId: string,
  data: CreatePipelineWebhookInput,
): Promise<PipelineWebhook> {
  const response = await apiClient.post<ApiEnvelope<PipelineWebhook>>(
    `/api/pipelines/${pipelineId}/webhooks`,
    data,
  );
  return normalizeWebhook(response.data.data);
}

export async function updatePipelineWebhookStatus(
  pipelineId: string,
  webhookId: string,
  isActive: boolean,
): Promise<PipelineWebhook> {
  const response = await apiClient.patch<ApiEnvelope<PipelineWebhook>>(
    `/api/pipelines/${pipelineId}/webhooks/${webhookId}`,
    { isActive },
  );
  return normalizeWebhook(response.data.data);
}

export async function triggerPipeline(
  pipelineId: string,
  data: TriggerPipelineInput,
): Promise<TriggerPipelineResult> {
  const response = await apiClient.post<ApiEnvelope<TriggerPipelineResult>>(
    `/api/pipelines/${pipelineId}/trigger`,
    data,
  );

  return response.data.data;
}

export async function getPipelineSubscribers(pipelineId: string): Promise<PipelineSubscriber[]> {
  const response = await apiClient.get<ApiEnvelope<PipelineSubscriber[]>>(`/api/pipelines/${pipelineId}/subscribers`);
  const items = Array.isArray(response.data.data) ? response.data.data : [];
  return items.map((item) => normalizeSubscriber(item));
}

export async function createPipelineSubscriber(
  pipelineId: string,
  data: CreatePipelineSubscriberInput,
): Promise<PipelineSubscriber> {
  const response = await apiClient.post<ApiEnvelope<PipelineSubscriber>>(
    `/api/pipelines/${pipelineId}/subscribers`,
    data,
  );

  return normalizeSubscriber(response.data.data);
}

export async function deletePipelineSubscriber(pipelineId: string, subscriberId: string): Promise<void> {
  await apiClient.delete(`/api/pipelines/${pipelineId}/subscribers/${subscriberId}`);
}
