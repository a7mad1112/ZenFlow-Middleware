import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Formik } from 'formik';
import * as Yup from 'yup';
import { ArrowRight, Loader2, Play, Plus, Trash2, X } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import {
  createPipeline,
  createPipelineWebhook,
  deletePipeline,
  getPipelineWebhooks,
  getPipelines,
  toggleAction,
  type ActionType,
  type Pipeline,
  type PipelineWebhook,
  triggerPipeline,
  updatePipelineWebhookStatus,
} from '../services/pipelines.service';

type LoadState = 'idle' | 'loading' | 'success' | 'error';

const actionItems: Array<{ key: ActionType; label: string }> = [
  { key: 'CONVERTER', label: 'XML' },
  { key: 'DISCORD', label: 'Discord' },
  { key: 'EMAIL', label: 'Email' },
  { key: 'PDF', label: 'PDF' },
  { key: 'AI_SUMMARIZER', label: 'AI' },
];

const pipelineSchema = Yup.object({
  name: Yup.string().trim().required('Name is required').max(255, 'Name is too long'),
  description: Yup.string().max(1000, 'Description is too long').optional(),
});

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return 'N/A';
  }
  return date.toLocaleString();
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return 'N/A';
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function buildActionFlow(enabledActions: ActionType[]): string[] {
  return actionItems
    .filter((item) => enabledActions.includes(item.key))
    .map((item) => item.label);
}

function buildActionTypeText(enabledActions: ActionType[]): string {
  const flow = buildActionFlow(enabledActions);
  return flow.length > 0 ? flow.join('-') : 'No active actions';
}

function ActionFlow({ actions }: { actions: string[] }) {
  if (actions.length === 0) {
    return <p className="text-xs text-zinc-500">No active actions configured.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {actions.map((action, index) => (
        <div key={`${action}:${index}`} className="flex items-center gap-1.5">
          <Badge className="bg-sky-500/15 text-sky-300">{action}</Badge>
          {index < actions.length - 1 && <ArrowRight size={13} className="text-zinc-500" />}
        </div>
      ))}
    </div>
  );
}

function ToggleButton({
  checked,
  onClick,
  label,
  disabled,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
        checked ? 'bg-emerald-500/70' : 'bg-zinc-700'
      } ${disabled ? 'opacity-50' : ''}`}
      title={label}
    >
      <span className="sr-only">Toggle {label}</span>
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-8' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export function PipelinesPage() {
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [webhooksByPipeline, setWebhooksByPipeline] = useState<Record<string, PipelineWebhook[]>>({});
  const [newWebhookByPipeline, setNewWebhookByPipeline] = useState<
    Record<string, { eventType: string; url: string; isActive: boolean }>
  >({});
  const [state, setState] = useState<LoadState>('idle');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [triggerModalPipelineId, setTriggerModalPipelineId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [triggerResult, setTriggerResult] = useState<{ taskId: string; pipelineName: string } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const defaultTriggerPayload = JSON.stringify(
    {
      eventType: 'order.created',
      orderId: 'ORD-1001',
      customer: {
        name: 'Jane Doe',
        email: 'jane@example.com',
      },
      total: 149.99,
      currency: 'USD',
      metadata: {
        source: 'dashboard-manual-trigger',
      },
    },
    null,
    2,
  );

  const fetchPipelines = useCallback(async () => {
    setState((prev) => (prev === 'success' ? 'success' : 'loading'));
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const data = await getPipelines();
      setPipelines(data);

      const webhookPairs = await Promise.all(
        data.map(async (pipeline) => ({
          pipelineId: pipeline.id,
          webhooks: await getPipelineWebhooks(pipeline.id),
        })),
      );

      setWebhooksByPipeline(
        webhookPairs.reduce<Record<string, PipelineWebhook[]>>((acc, item) => {
          acc[item.pipelineId] = item.webhooks;
          return acc;
        }, {}),
      );

      setNewWebhookByPipeline((prev) => {
        const next = { ...prev };
        for (const pipeline of data) {
          if (!next[pipeline.id]) {
            next[pipeline.id] = {
              eventType: '',
              url: '',
              isActive: true,
            };
          }
        }
        return next;
      });

      setState('success');
    } catch {
      setState('error');
      setErrorMessage('Failed to load pipelines.');
    }
  }, []);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  const pipelineCountLabel = useMemo(() => `${pipelines.length} pipeline(s)`, [pipelines.length]);

  async function handleDelete(id: string) {
    setBusyAction(`delete:${id}`);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await deletePipeline(id);
      await fetchPipelines();
    } catch {
      setErrorMessage('Unable to delete pipeline.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleToggle(pipeline: Pipeline, action: ActionType) {
    const current = pipeline.enabledActions.includes(action);
    setBusyAction(`toggle:${pipeline.id}:${action}`);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await toggleAction(pipeline.id, action, !current);
      await fetchPipelines();
    } catch {
      setErrorMessage(`Failed to update ${action} toggle.`);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleAddWebhook(pipelineId: string) {
    const draft = newWebhookByPipeline[pipelineId] ?? {
      eventType: '',
      url: '',
      isActive: true,
    };

    if (!draft.eventType.trim() || !draft.url.trim()) {
      setErrorMessage('Event type and target URL are required for webhook creation.');
      return;
    }

    setBusyAction(`webhook-create:${pipelineId}`);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await createPipelineWebhook(pipelineId, {
        eventType: draft.eventType.trim(),
        url: draft.url.trim(),
        isActive: draft.isActive,
      });

      const refreshed = await getPipelineWebhooks(pipelineId);
      setWebhooksByPipeline((prev) => ({
        ...prev,
        [pipelineId]: refreshed,
      }));

      setNewWebhookByPipeline((prev) => ({
        ...prev,
        [pipelineId]: {
          eventType: '',
          url: '',
          isActive: true,
        },
      }));
    } catch {
      setErrorMessage('Failed to add event webhook.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleToggleWebhookStatus(
    pipelineId: string,
    webhookId: string,
    nextIsActive: boolean,
  ) {
    setBusyAction(`webhook-toggle:${webhookId}`);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updatePipelineWebhookStatus(pipelineId, webhookId, nextIsActive);
      const refreshed = await getPipelineWebhooks(pipelineId);
      setWebhooksByPipeline((prev) => ({
        ...prev,
        [pipelineId]: refreshed,
      }));
    } catch {
      setErrorMessage('Failed to update webhook status.');
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-100">Pipeline Management</h2>
          <p className="mt-1 text-sm text-zinc-400">Manage pipelines and action toggles from one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{pipelineCountLabel}</Badge>
          <Button className="gap-2" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} />
            New Pipeline
          </Button>
        </div>
      </div>

      {state === 'loading' && pipelines.length === 0 && (
        <Card className="flex items-center gap-2 text-zinc-300">
          <Loader2 className="animate-spin" size={16} />
          Loading pipelines...
        </Card>
      )}

      {errorMessage && <Card className="border-rose-500/30 bg-rose-500/10 text-rose-200">{errorMessage}</Card>}
      {successMessage && <Card className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200">{successMessage}</Card>}

      <div className="grid gap-4 lg:grid-cols-2">
        {pipelines.map((pipeline) => (
          <Card key={pipeline.id} className="space-y-4">
            {/** Observability metadata block */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-zinc-100">{pipeline.name}</h3>
                <p className="mt-1 break-all font-mono text-xs text-zinc-400">{pipeline.id}</p>
                {pipeline.description && (
                  <p className="mt-2 text-sm text-zinc-300">{pipeline.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={pipeline.isActive ? 'success' : 'warning'}>
                  {pipeline.isActive ? 'Active' : 'Inactive'}
                </Badge>
                <Button
                  variant="ghost"
                  className="gap-2 px-2"
                  onClick={() => {
                    setTriggerModalPipelineId(pipeline.id);
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                >
                  <Play size={15} />
                  Trigger
                </Button>
                <Button
                  variant="ghost"
                  className="px-2"
                  onClick={() => handleDelete(pipeline.id)}
                  disabled={busyAction === `delete:${pipeline.id}`}
                  aria-label="Delete pipeline"
                >
                  {busyAction === `delete:${pipeline.id}` ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Action Type</p>
              <p className="mt-1 text-sm font-medium text-zinc-100">
                {buildActionTypeText(pipeline.enabledActions)}
              </p>
              <p className="mt-2 text-xs uppercase tracking-wide text-zinc-500">Created Date</p>
              <p className="mt-1 text-sm text-zinc-300">{formatShortDate(pipeline.createdAt)}</p>
            </div>

            <div className="space-y-2 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Action Flow</p>
              <ActionFlow actions={buildActionFlow(pipeline.enabledActions)} />
            </div>

            <div className="space-y-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Event Webhooks</p>

              <div className="overflow-x-auto rounded-md border border-zinc-800">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="bg-zinc-900 text-zinc-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Event Type</th>
                      <th className="px-3 py-2 font-medium">Target URL</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(webhooksByPipeline[pipeline.id] ?? []).map((webhook) => (
                      <tr key={webhook.id} className="border-t border-zinc-800 text-zinc-200">
                        <td className="px-3 py-2 font-mono">{webhook.eventType}</td>
                        <td className="max-w-[320px] truncate px-3 py-2" title={webhook.url}>
                          {webhook.url}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={webhook.isActive ? 'success' : 'warning'}>
                              {webhook.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            <ToggleButton
                              checked={webhook.isActive}
                              onClick={() =>
                                handleToggleWebhookStatus(pipeline.id, webhook.id, !webhook.isActive)
                              }
                              label={`${webhook.eventType} status`}
                              disabled={busyAction === `webhook-toggle:${webhook.id}`}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(webhooksByPipeline[pipeline.id] ?? []).length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-3 text-zinc-500">
                          No event webhooks configured yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-2 md:grid-cols-[1fr_1.6fr_auto_auto]">
                <input
                  value={newWebhookByPipeline[pipeline.id]?.eventType ?? ''}
                  onChange={(event) =>
                    setNewWebhookByPipeline((prev) => ({
                      ...prev,
                      [pipeline.id]: {
                        ...(prev[pipeline.id] ?? { eventType: '', url: '', isActive: true }),
                        eventType: event.target.value,
                      },
                    }))
                  }
                  placeholder="order.created"
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                />
                <input
                  value={newWebhookByPipeline[pipeline.id]?.url ?? ''}
                  onChange={(event) =>
                    setNewWebhookByPipeline((prev) => ({
                      ...prev,
                      [pipeline.id]: {
                        ...(prev[pipeline.id] ?? { eventType: '', url: '', isActive: true }),
                        url: event.target.value,
                      },
                    }))
                  }
                  placeholder="https://example.com/webhook"
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="text-xs"
                  onClick={() =>
                    setNewWebhookByPipeline((prev) => ({
                      ...prev,
                      [pipeline.id]: {
                        ...(prev[pipeline.id] ?? { eventType: '', url: '', isActive: true }),
                        isActive: !(prev[pipeline.id]?.isActive ?? true),
                      },
                    }))
                  }
                >
                  {(newWebhookByPipeline[pipeline.id]?.isActive ?? true) ? 'Active' : 'Inactive'}
                </Button>
                <Button
                  type="button"
                  className="text-xs"
                  disabled={busyAction === `webhook-create:${pipeline.id}`}
                  onClick={() => handleAddWebhook(pipeline.id)}
                >
                  {busyAction === `webhook-create:${pipeline.id}` ? 'Saving...' : 'Add Event'}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {actionItems.map((item) => {
                const isEnabled = pipeline.enabledActions.includes(item.key);
                const isBusy = busyAction === `toggle:${pipeline.id}:${item.key}`;

                return (
                  <div key={item.key} className="flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{item.label}</p>
                      <p className="text-xs text-zinc-400">{item.key}</p>
                    </div>
                    {isBusy ? (
                      <Loader2 className="animate-spin text-zinc-300" size={16} />
                    ) : (
                      <ToggleButton
                        checked={isEnabled}
                        onClick={() => handleToggle(pipeline, item.key)}
                        label={item.label}
                        disabled={Boolean(busyAction)}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-zinc-500">Updated: {formatDate(pipeline.updatedAt)}</p>
          </Card>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-100">Create Pipeline</h3>
              <Button variant="ghost" className="px-2" onClick={() => setIsModalOpen(false)}>
                <X size={16} />
              </Button>
            </div>

            <Formik
              initialValues={{
                name: '',
                description: '',
                xmlEnabled: true,
                aiEnabled: false,
                pdfEnabled: false,
                emailEnabled: false,
                discordEnabled: false,
              }}
              validationSchema={pipelineSchema}
              onSubmit={async (values, helpers) => {
                helpers.setSubmitting(true);
                setErrorMessage(null);
                try {
                  const enabledActions: ActionType[] = [
                    ...(values.xmlEnabled ? (['CONVERTER'] as const) : []),
                    ...(values.aiEnabled ? (['AI_SUMMARIZER'] as const) : []),
                    ...(values.pdfEnabled ? (['PDF'] as const) : []),
                    ...(values.emailEnabled ? (['EMAIL'] as const) : []),
                    ...(values.discordEnabled ? (['DISCORD'] as const) : []),
                  ];

                  const derivedPrimaryAction = enabledActions[0];

                  if (!derivedPrimaryAction) {
                    setErrorMessage('Select at least one action before creating a pipeline.');
                    helpers.setSubmitting(false);
                    return;
                  }

                  await createPipeline({
                    name: values.name.trim(),
                    description: values.description.trim() || undefined,
                    actionType: derivedPrimaryAction,
                    enabledActions,
                    emailEnabled: values.emailEnabled,
                    discordEnabled: values.discordEnabled,
                    config: {
                      featureFlags: {
                        xmlEnabled: values.xmlEnabled,
                        aiEnabled: values.aiEnabled,
                        pdfEnabled: values.pdfEnabled,
                        emailEnabled: values.emailEnabled,
                        discordEnabled: values.discordEnabled,
                      },
                    },
                  });
                  helpers.resetForm();
                  setIsModalOpen(false);
                  await fetchPipelines();
                } catch {
                  setErrorMessage('Failed to create pipeline.');
                } finally {
                  helpers.setSubmitting(false);
                }
              }}
            >
              {({ values, errors, touched, handleChange, isSubmitting, setFieldValue }) => (
                <Form className="space-y-4">
                  <div>
                    <label htmlFor="name" className="mb-1 block text-sm text-zinc-300">
                      Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      value={values.name}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                    />
                    {touched.name && errors.name && (
                      <p className="mt-1 text-xs text-rose-300">{errors.name}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="description" className="mb-1 block text-sm text-zinc-300">
                      Description
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={values.description}
                      onChange={handleChange}
                      rows={3}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                    />
                    {touched.description && errors.description && (
                      <p className="mt-1 text-xs text-rose-300">{errors.description}</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-3">
                    <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
                      Feature Checklist
                    </p>
                    <ActionFlow
                      actions={[
                        ...(values.xmlEnabled ? ['XML'] : []),
                        ...(values.aiEnabled ? ['AI'] : []),
                        ...(values.pdfEnabled ? ['PDF'] : []),
                        ...(values.emailEnabled ? ['Email'] : []),
                        ...(values.discordEnabled ? ['Discord'] : []),
                      ]}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">XML</p>
                        <p className="text-xs text-zinc-400">CONVERTER</p>
                      </div>
                      <ToggleButton
                        checked={values.xmlEnabled}
                        onClick={() => setFieldValue('xmlEnabled', !values.xmlEnabled)}
                        label="XML"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">AI</p>
                        <p className="text-xs text-zinc-400">AI_SUMMARIZER</p>
                      </div>
                      <ToggleButton
                        checked={values.aiEnabled}
                        onClick={() => setFieldValue('aiEnabled', !values.aiEnabled)}
                        label="AI"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">PDF</p>
                        <p className="text-xs text-zinc-400">PDF</p>
                      </div>
                      <ToggleButton
                        checked={values.pdfEnabled}
                        onClick={() => setFieldValue('pdfEnabled', !values.pdfEnabled)}
                        label="PDF"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">Email</p>
                        <p className="text-xs text-zinc-400">EMAIL</p>
                      </div>
                      <ToggleButton
                        checked={values.emailEnabled}
                        onClick={() => setFieldValue('emailEnabled', !values.emailEnabled)}
                        label="Email"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-2 sm:col-span-2">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">Discord</p>
                        <p className="text-xs text-zinc-400">DISCORD</p>
                      </div>
                      <ToggleButton
                        checked={values.discordEnabled}
                        onClick={() => setFieldValue('discordEnabled', !values.discordEnabled)}
                        label="Discord"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Creating...' : 'Create Pipeline'}
                    </Button>
                  </div>
                </Form>
              )}
            </Formik>
          </Card>
        </div>
      )}

      {triggerModalPipelineId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-100">Trigger Pipeline Manually</h3>
              <Button
                variant="ghost"
                className="px-2"
                onClick={() => {
                  setTriggerModalPipelineId(null);
                  setTriggerResult(null);
                }}
              >
                <X size={16} />
              </Button>
            </div>

            <Formik
              initialValues={{
                eventType: '',
                payloadText: defaultTriggerPayload,
              }}
              onSubmit={async (values, helpers) => {
                if (!triggerModalPipelineId) {
                  return;
                }

                helpers.setSubmitting(true);
                setErrorMessage(null);
                setSuccessMessage(null);

                try {
                  let payload: Record<string, unknown>;
                  try {
                    const parsed = JSON.parse(values.payloadText);
                    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                      throw new Error('Payload must be a JSON object');
                    }
                    payload = parsed as Record<string, unknown>;
                  } catch {
                    setErrorMessage('Payload must be valid JSON object.');
                    return;
                  }

                  const result = await triggerPipeline(triggerModalPipelineId, {
                    payload,
                    eventType: values.eventType || undefined,
                  });

                  const pipelineName =
                    pipelines.find((item) => item.id === triggerModalPipelineId)?.name ?? triggerModalPipelineId;

                  setTriggerResult({
                    taskId: result.taskId,
                    pipelineName,
                  });
                  setSuccessMessage(`Pipeline triggered successfully. Log ID: ${result.taskId}`);
                } catch {
                  setErrorMessage('Failed to trigger pipeline manually.');
                } finally {
                  helpers.setSubmitting(false);
                }
              }}
            >
              {({ values, handleChange, isSubmitting }) => {
                const pipelineWebhooks = webhooksByPipeline[triggerModalPipelineId] ?? [];

                return (
                  <Form className="space-y-4">
                    <div>
                      <label htmlFor="eventType" className="mb-1 block text-sm text-zinc-300">
                        Event Type Context
                      </label>
                      <select
                        id="eventType"
                        name="eventType"
                        value={values.eventType}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                      >
                        <option value="">No event context</option>
                        {pipelineWebhooks.map((webhook) => (
                          <option key={webhook.id} value={webhook.eventType}>
                            {webhook.eventType} ({webhook.isActive ? 'Active' : 'Inactive'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="payloadText" className="mb-1 block text-sm text-zinc-300">
                        JSON Payload
                      </label>
                      <textarea
                        id="payloadText"
                        name="payloadText"
                        value={values.payloadText}
                        onChange={handleChange}
                        rows={14}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100"
                      />
                    </div>

                    {triggerResult && (
                      <Card className="border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-100">
                        <p className="text-sm">
                          Success: <span className="font-semibold">{triggerResult.pipelineName}</span> dispatched.
                        </p>
                        <button
                          type="button"
                          className="mt-2 text-sm underline underline-offset-2"
                          onClick={() => navigate(`/logs?logId=${encodeURIComponent(triggerResult.taskId)}`)}
                        >
                          Open Log {triggerResult.taskId}
                        </button>
                      </Card>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setTriggerModalPipelineId(null);
                          setTriggerResult(null);
                        }}
                      >
                        Close
                      </Button>
                      <Button type="submit" disabled={isSubmitting} className="gap-2">
                        <Play size={14} />
                        {isSubmitting ? 'Running...' : 'Run Pipeline'}
                      </Button>
                    </div>
                  </Form>
                );
              }}
            </Formik>
          </Card>
        </div>
      )}
    </section>
  );
}
