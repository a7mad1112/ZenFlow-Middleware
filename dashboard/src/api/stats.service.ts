import { apiClient } from './client';

export interface DashboardStats {
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
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await apiClient.get<DashboardStats>('/api/stats');
  return response.data;
}
