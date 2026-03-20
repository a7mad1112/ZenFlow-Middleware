import { apiClient } from '../api/client';

export type ActionType = 'CONVERTER' | 'EMAIL' | 'DISCORD' | 'PDF' | 'AI_SUMMARIZER';

export interface Pipeline {
  id: string;
  name: string;
  description?: string | null;
  actionType: ActionType;
  enabledActions: ActionType[];
  discordEnabled: boolean;
  emailEnabled: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePipelineInput {
  name: string;
  description?: string;
  actionType: ActionType;
}

export interface UpdatePipelineInput {
  name?: string;
  description?: string;
  actionType?: ActionType;
  enabledActions?: ActionType[];
  discordEnabled?: boolean;
  emailEnabled?: boolean;
  isActive?: boolean;
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
    enabledActions: enabled,
    discordEnabled: Boolean(input.discordEnabled),
    emailEnabled: Boolean(input.emailEnabled),
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

  const response = await apiClient.patch<ApiEnvelope<Pipeline>>(`/api/pipelines/${pipelineId}`, payload);
  return normalizePipeline(response.data.data);
}
