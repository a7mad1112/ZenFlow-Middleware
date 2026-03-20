import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, X } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { getLogById, getLogs, type LogDetail, type LogListItem } from '../services/logs.service';

type LoadState = 'idle' | 'loading' | 'success' | 'error';
type TimelineState = 'done' | 'failed' | 'pending' | 'skipped';

type ResultShape = {
  xml?: unknown;
  aiSummary?: unknown;
  pdf?: {
    generated?: boolean;
    error?: string;
  };
  email?: {
    attempted?: boolean;
    sent?: boolean;
    skippedReason?: string;
    error?: string;
  };
};

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

function getTimelineFromResult(result: ResultShape | null): Array<{ label: string; state: TimelineState }> {
  const hasXml = Boolean(typeof result?.xml === 'string' && result.xml.length > 0);
  const hasAi = Boolean(typeof result?.aiSummary === 'string' && result.aiSummary.length > 0);

  const pdfState: TimelineState = result?.pdf?.generated
    ? 'done'
    : result?.pdf?.error
      ? 'failed'
      : 'pending';

  let emailState: TimelineState = 'pending';
  if (result?.email?.sent) {
    emailState = 'done';
  } else if (result?.email?.attempted && !result.email.sent) {
    emailState = 'failed';
  } else if (result?.email?.skippedReason) {
    emailState = 'skipped';
  }

  return [
    { label: 'XML Created', state: hasXml ? 'done' : 'pending' },
    { label: 'AI Analyzed', state: hasAi ? 'done' : 'pending' },
    { label: 'PDF Generated', state: pdfState },
    { label: 'Email Sent', state: emailState },
  ];
}

function TimelineBadge({ state }: { state: TimelineState }) {
  if (state === 'done') return <Badge variant="success">Done</Badge>;
  if (state === 'failed') return <Badge variant="danger">Failed</Badge>;
  if (state === 'skipped') return <Badge>Skipped</Badge>;
  return <Badge variant="warning">Pending</Badge>;
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

  const resultObject = useMemo(() => {
    if (!detail?.result || typeof detail.result !== 'object' || Array.isArray(detail.result)) {
      return null;
    }
    return detail.result as ResultShape;
  }, [detail?.result]);

  const timeline = useMemo(() => getTimelineFromResult(resultObject), [resultObject]);

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

      {selectedLogId && (
        <div className="fixed inset-0 z-30 flex justify-end bg-black/50">
          <aside className="h-full w-full max-w-2xl overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-zinc-100">Log Detail</h3>
                <p className="text-xs text-zinc-400">{selectedLogId}</p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedLogId(null);
                  setDetail(null);
                  setDetailState('idle');
                }}
                aria-label="Close drawer"
              >
                <X size={18} />
              </Button>
            </div>

            {detailState === 'loading' && (
              <Card className="flex items-center gap-2 text-zinc-300">
                <Loader2 size={16} className="animate-spin" />
                Loading detail...
              </Card>
            )}

            {detailState === 'error' && (
              <Card className="border-rose-500/30 bg-rose-500/10 text-rose-200">
                Failed to load detail for this log.
              </Card>
            )}

            {detailState === 'success' && detail && (
              <div className="space-y-4">
                <Card className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={getStatusVariant(detail.status)}>{detail.status}</Badge>
                    <Badge variant={getRiskVariant(detail.riskLevel)}>
                      Risk: {detail.riskLevel ?? 'Unknown'}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-400">Pipeline: {detail.pipeline?.name ?? 'N/A'}</p>
                  <p className="text-sm text-zinc-400">Updated: {formatDate(detail.updatedAt)}</p>
                  {detail.error && <p className="text-sm text-rose-300">Error: {detail.error}</p>}
                </Card>

                <Card className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400">
                    Timeline
                  </h4>
                  <div className="space-y-2">
                    {timeline.map((step) => (
                      <div key={step.label} className="flex items-center justify-between rounded-md bg-zinc-900 px-3 py-2">
                        <p className="text-sm text-zinc-200">{step.label}</p>
                        <TimelineBadge state={step.state} />
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400">
                    AI Analysis
                  </h4>
                  <p className="whitespace-pre-wrap rounded-md bg-zinc-900 p-3 text-sm text-zinc-200">
                    {typeof resultObject?.aiSummary === 'string'
                      ? resultObject.aiSummary
                      : 'No AI summary available.'}
                  </p>
                </Card>

                <Card className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400">
                    PDF Status
                  </h4>
                  <p className="text-sm text-zinc-200">
                    {resultObject?.pdf?.generated
                      ? 'PDF generated successfully.'
                      : resultObject?.pdf?.error
                        ? `PDF failed: ${resultObject.pdf.error}`
                        : 'PDF not generated yet.'}
                  </p>
                </Card>

                <Card className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400">
                    Request Payload
                  </h4>
                  <pre className="overflow-x-auto rounded-md bg-zinc-900 p-3 text-xs text-zinc-200">
                    {JSON.stringify(detail.payload ?? {}, null, 2)}
                  </pre>
                </Card>
              </div>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
