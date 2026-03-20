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

interface ApiResponse<T> {
  success?: boolean;
  data: T;
}

function normalizeStats(stats: Partial<DashboardStats>): DashboardStats {
  return {
    totalTasks: stats.totalTasks ?? 0,
    successRate: stats.successRate ?? 0,
    statusCounts: {
      pending: stats.statusCounts?.pending ?? 0,
      processing: stats.statusCounts?.processing ?? 0,
      completed: stats.statusCounts?.completed ?? 0,
      failed: stats.statusCounts?.failed ?? 0,
    },
    riskDistribution: {
      Low: stats.riskDistribution?.Low ?? 0,
      Medium: stats.riskDistribution?.Medium ?? 0,
      High: stats.riskDistribution?.High ?? 0,
    },
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await apiClient.get<ApiResponse<DashboardStats> | DashboardStats>('/api/stats');
  const payload = 'data' in response.data ? response.data.data : response.data;
  return normalizeStats(payload);
}
