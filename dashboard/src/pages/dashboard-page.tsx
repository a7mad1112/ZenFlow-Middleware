import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Loader2 } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { getDashboardStats, type DashboardStats } from '../api/stats.service';

type LoadState = 'idle' | 'loading' | 'success' | 'error';

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
            </div>
          </Card>
        </>
      )}
    </section>
  );
}
