import { useCallback, useEffect, useMemo, useState } from 'react';
import { Form, Formik } from 'formik';
import * as Yup from 'yup';
import { ArrowRight, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import {
  createPipeline,
  deletePipeline,
  getPipelines,
  toggleAction,
  type ActionType,
  type Pipeline,
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
  actionType: Yup.mixed<ActionType>()
    .oneOf(['CONVERTER', 'EMAIL', 'DISCORD', 'PDF', 'AI_SUMMARIZER'])
    .required('Action type is required'),
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
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [state, setState] = useState<LoadState>('idle');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const fetchPipelines = useCallback(async () => {
    setState((prev) => (prev === 'success' ? 'success' : 'loading'));
    setErrorMessage(null);
    try {
      const data = await getPipelines();
      setPipelines(data);
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
    try {
      await toggleAction(pipeline.id, action, !current);
      await fetchPipelines();
    } catch {
      setErrorMessage(`Failed to update ${action} toggle.`);
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
                actionType: 'CONVERTER' as ActionType,
              }}
              validationSchema={pipelineSchema}
              onSubmit={async (values, helpers) => {
                helpers.setSubmitting(true);
                setErrorMessage(null);
                try {
                  await createPipeline({
                    name: values.name.trim(),
                    description: values.description.trim() || undefined,
                    actionType: values.actionType,
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
              {({ values, errors, touched, handleChange, isSubmitting }) => (
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

                  <div>
                    <label htmlFor="actionType" className="mb-1 block text-sm text-zinc-300">
                      Action Type
                    </label>
                    <select
                      id="actionType"
                      name="actionType"
                      value={values.actionType}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                    >
                      <option value="CONVERTER">CONVERTER</option>
                      <option value="DISCORD">DISCORD</option>
                      <option value="EMAIL">EMAIL</option>
                      <option value="PDF">PDF</option>
                      <option value="AI_SUMMARIZER">AI_SUMMARIZER</option>
                    </select>
                    {touched.actionType && errors.actionType && (
                      <p className="mt-1 text-xs text-rose-300">{errors.actionType}</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-3">
                    <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                      <Sparkles size={13} />
                      Action Preview
                    </p>
                    <ActionFlow
                      actions={
                        actionItems
                          .filter((item) => item.key === values.actionType)
                          .map((item) => item.label)
                      }
                    />
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
    </section>
  );
}
