import { apiClient } from '../api/client';

interface ChatResponseEnvelope {
  success?: boolean;
  data?: {
    answer?: unknown;
  };
  answer?: unknown;
}

export async function sendAiChatMessage(message: string): Promise<string> {
  const response = await apiClient.post<ChatResponseEnvelope>('/api/ai/chat', {
    message,
  });

  const nestedAnswer = response.data.data?.answer;
  if (typeof nestedAnswer === 'string' && nestedAnswer.trim().length > 0) {
    return nestedAnswer;
  }

  if (typeof response.data.answer === 'string' && response.data.answer.trim().length > 0) {
    return response.data.answer;
  }

  throw new Error('Invalid AI chat response from server');
}
