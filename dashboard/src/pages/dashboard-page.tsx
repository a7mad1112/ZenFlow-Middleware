import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Loader2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { getDashboardStats, type DashboardStats } from '../api/stats.service';

type LoadState = 'idle' | 'loading' | 'success' | 'error';

const statusColors = {
  Completed: '#34d399',
  Failed: '#f43f5e',
  Stuck: '#e11d48',
  Pending: '#38bdf8',
  Processing: '#60a5fa',
};

const riskColors = {
  Low: '#34d399',
  Medium: '#facc15',
  High: '#f43f5e',
};

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [state, setState] = useState<LoadState>('idle');

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      setState('loading');
      try {
        const data = await getDashboardStats();
        if (!cancelled) {
          setStats(data);
          setState('success');
        }
      } catch {
        if (!cancelled) {
          setState('error');
        }
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = useMemo(() => {
    if (!stats) {
      return [];
    }

    return [
      {
        title: 'Total Tasks',
        value: stats.totalTasks,
        icon: Clock3,
      },
      {
        title: 'Success Rate',
        value: `${stats.successRate}%`,
        icon: CheckCircle2,
      },
      {
        title: 'Failed Tasks',
        value: stats.statusCounts.failed,
        icon: AlertTriangle,
      },
    ];
  }, [stats]);

  const statusChartData = useMemo(() => {
    if (!stats) {
      return [];
    }

    return [
      { name: 'Completed', value: stats.statusCounts.completed },
      { name: 'Failed', value: stats.statusCounts.failed },
      { name: 'Stuck', value: stats.statusCounts.stuck },
      { name: 'Pending', value: stats.statusCounts.pending },
      { name: 'Processing', value: stats.statusCounts.processing },
    ];
  }, [stats]);

  const riskChartData = useMemo(() => {
    if (!stats) {
      return [];
    }

    return [
      { name: 'Low', value: stats.riskDistribution.Low },
      { name: 'Medium', value: stats.riskDistribution.Medium },
      { name: 'High', value: stats.riskDistribution.High },
    ];
  }, [stats]);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-zinc-100">Stats Overview</h2>
        <p className="mt-1 text-sm text-zinc-400">Live summary from /api/stats.</p>
      </div>

      {state === 'loading' && (
        <Card className="flex items-center gap-3 text-zinc-300">
          <Loader2 className="animate-spin" size={16} />
          Loading dashboard stats...
        </Card>
      )}

      {state === 'error' && (
        <Card className="border-rose-500/30 bg-rose-500/10 text-rose-200">
          Failed to fetch stats from /api/stats. Check API base URL and backend status.
        </Card>
      )}

      {state === 'success' && stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title} className="space-y-3">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-sm">{card.title}</span>
                    <Icon size={16} />
                  </div>
                  <p className="text-3xl font-semibold text-zinc-100">{card.value}</p>
                </Card>
              );
            })}
          </div>

          <Card className="space-y-4">
            <h3 className="text-sm font-medium uppercase tracking-[0.12em] text-zinc-400">
              Status Distribution
            </h3>
            <div className="flex flex-wrap gap-2">
              <Badge>Pending: {stats.statusCounts.pending}</Badge>
              <Badge variant="warning">Processing: {stats.statusCounts.processing}</Badge>
              <Badge variant="success">Completed: {stats.statusCounts.completed}</Badge>
              <Badge variant="danger">Failed: {stats.statusCounts.failed}</Badge>
              <Badge variant="danger">Stuck: {stats.statusCounts.stuck}</Badge>
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="space-y-4">
              <h3 className="text-sm font-medium uppercase tracking-[0.12em] text-zinc-400">
                StatusChart
              </h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                    >
                      {statusChartData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={statusColors[entry.name as keyof typeof statusColors]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#111827',
                        border: '1px solid #3f3f46',
                        color: '#e4e4e7',
                      }}
                    />
                    <Legend wrapperStyle={{ color: '#d4d4d8' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="space-y-4">
              <h3 className="text-sm font-medium uppercase tracking-[0.12em] text-zinc-400">
                RiskAnalysis
              </h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={riskChartData}>
                    <CartesianGrid stroke="#3f3f46" strokeDasharray="3 3" />
                    <XAxis dataKey="name" stroke="#a1a1aa" />
                    <YAxis stroke="#a1a1aa" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#111827',
                        border: '1px solid #3f3f46',
                        color: '#e4e4e7',
                      }}
                    />
                    <Legend wrapperStyle={{ color: '#d4d4d8' }} />
                    <Bar dataKey="value" name="Risk Count" radius={[8, 8, 0, 0]}>
                      {riskChartData.map((entry) => (
                        <Cell key={entry.name} fill={riskColors[entry.name as keyof typeof riskColors]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
