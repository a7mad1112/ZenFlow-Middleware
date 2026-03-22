/**
 * Core domain types for the webhook task processing system
 */

export interface WebhookPayload {
  id: string;
  eventType: string;
  data: Record<string, unknown>;
  timestamp: Date;
  userId?: string;
}

export interface Task {
  id: string;
  webhook_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'stuck';
  payload: WebhookPayload;
  attempts: number;
  max_attempts: number;
  error?: string;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
}

export interface TaskResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}
