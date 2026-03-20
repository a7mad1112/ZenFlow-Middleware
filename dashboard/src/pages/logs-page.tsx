import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { LogDetailDrawer } from '../components/logs/LogDetailDrawer';
import { getLogById, getLogs, type LogDetail, type LogListItem } from '../services/logs.service';

type LoadState = 'idle' | 'loading' | 'success' | 'error';

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return 'N/A';
  }
  return date.toLocaleString();
}

function getStatusVariant(status: string): 'success' | 'danger' | 'warning' {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'danger';
  return 'warning';
}

function getRiskVariant(riskLevel: LogListItem['riskLevel']): 'success' | 'warning' | 'danger' | 'default' {
  if (riskLevel === 'Low') return 'success';
  if (riskLevel === 'Medium') return 'warning';
  if (riskLevel === 'High') return 'danger';
  return 'default';
}

export function LogsPage() {
  const [logs, setLogs] = useState<LogListItem[]>([]);
  const [state, setState] = useState<LoadState>('idle');
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LogDetail | null>(null);
  const [detailState, setDetailState] = useState<LoadState>('idle');

  const fetchLogs = useCallback(async () => {
    setState((prev) => (prev === 'success' ? 'success' : 'loading'));
    try {
      const response = await getLogs({ page: 1, limit: 50 });
      setLogs(response.data);
      setState('success');
    } catch {
      setState('error');
    }
  }, []);

  const fetchDetail = useCallback(async (id: string) => {
    setDetailState('loading');
    try {
      const response = await getLogById(id);
      setDetail(response);
      setDetailState('success');
    } catch {
      setDetailState('error');
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      fetchLogs();
      if (selectedLogId) {
        fetchDetail(selectedLogId);
      }
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [fetchLogs, fetchDetail, selectedLogId]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-100">Logs Monitoring</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Live events from /api/logs with 5-second polling.
          </p>
        </div>
        <Button onClick={fetchLogs} className="gap-2">
          <RefreshCw size={15} />
          Refresh
        </Button>
      </div>

      {state === 'loading' && logs.length === 0 && (
        <Card className="flex items-center gap-2 text-zinc-300">
          <Loader2 size={16} className="animate-spin" />
          Loading logs...
        </Card>
      )}

      {state === 'error' && (
        <Card className="border-rose-500/30 bg-rose-500/10 text-rose-200">
          Could not fetch logs. Verify backend and API base URL.
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">Task</th>
              <th className="px-4 py-3 font-medium">Pipeline</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Risk</th>
              <th className="px-4 py-3 font-medium">Attempts</th>
              <th className="px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr
                key={log.id}
                className="cursor-pointer border-b border-zinc-800/70 text-zinc-200 transition-colors hover:bg-zinc-900/50"
                onClick={() => {
                  setSelectedLogId(log.id);
                  fetchDetail(log.id);
                }}
              >
                <td className="px-4 py-3 font-mono text-xs">{log.id.slice(0, 10)}...</td>
                <td className="px-4 py-3">{log.pipeline?.name ?? 'N/A'}</td>
                <td className="px-4 py-3">
                  <Badge variant={getStatusVariant(log.status)}>{log.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={getRiskVariant(log.riskLevel)}>{log.riskLevel ?? 'Unknown'}</Badge>
                </td>
                <td className="px-4 py-3">{log.attempts}</td>
                <td className="px-4 py-3 text-zinc-400">{formatDate(log.updatedAt)}</td>
              </tr>
            ))}
            {logs.length === 0 && state === 'success' && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-400">
                  No logs yet. Send a webhook from Postman and it will appear here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <LogDetailDrawer
        selectedLogId={selectedLogId}
        detail={detail}
        detailState={detailState}
        onClose={() => {
          setSelectedLogId(null);
          setDetail(null);
          setDetailState('idle');
        }}
      />
    </section>
  );
}
